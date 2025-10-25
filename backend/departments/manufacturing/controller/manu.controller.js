const ManufacturingModel = require("../model/manu.model");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const pathConfig = require('../../../utils/pathConfig'); // Import path configuration
const { sendLaborSubmissionNotification } = require('../../../utils/emailService');
const Notifications = require('../../../models/notification.model');

// Configure multer for project image uploads
const projectUploadDir = pathConfig.getUploadPath('projects');

// Ensure the upload directory exists
if (!fs.existsSync(projectUploadDir)) {
  fs.mkdirSync(projectUploadDir, { recursive: true });
}

const projectStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, projectUploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'project-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const projectUpload = multer({
  storage: projectStorage,
  fileFilter: (req, file, cb) => {
    // Allow documents for blueprints
    const allowedDocTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/gif'];
    
    if (allowedDocTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only PDF, JPEG, PNG, and GIF are allowed for blueprints.'));
    }
  },
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit for documents
  }
});

// Configure multer for signature uploads
const signatureUploadDir = pathConfig.getUploadPath('signatures');

// Ensure the signature upload directory exists
if (!fs.existsSync(signatureUploadDir)) {
  fs.mkdirSync(signatureUploadDir, { recursive: true });
}

const signatureStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, signatureUploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'signature-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const signatureUpload = multer({
  storage: signatureStorage,
  fileFilter: (req, file, cb) => {
    // Allow only image files for signatures
    const allowedImageTypes = ['image/jpeg', 'image/png', 'image/gif'];
    
    if (allowedImageTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, and GIF images are allowed for signatures.'));
    }
  },
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit for signature images
  }
});

// Configure multer for construction worker picture uploads
const constructionWorkerStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, '..', '..', '..', 'uploads', 'construction_workers');
    // Create directory if it doesn't exist
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    // Generate unique filename: construction-worker_timestamp.extension
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `construction-worker-${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});

const constructionWorkerUpload = multer({
  storage: constructionWorkerStorage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: function (req, file, cb) {
    // Accept only image files (case-insensitive)
    if (!file.originalname.match(/\.(jpg|jpeg|png|gif)$/i)) {
      return cb(new Error('Only image files are allowed!'), false);
    }
    cb(null, true);
  }
}).single('picture');

const ManufacturingController = {
  createProject: async (req, res) => {
    try {
      const {
        project_name,
        location,
        blocks,
        description,
        developer_id
      } = req.body;

      // Validate required fields
      if (!project_name || !location || !blocks || !description || !developer_id) {
        return res.status(400).json({ 
          success: false,
          error: "All required fields must be filled" 
        });
      }

      // Insert proposal
      const proposalId = await ManufacturingModel.storeProject({
        project_name,
        location,
        blocks: parseInt(blocks),
        description,
        status: 'pending',
        developer_id
      });

      // Handle blueprint files if any
      if (req.files && req.files.blueprint_files) {
        const blueprintFiles = Array.isArray(req.files.blueprint_files) 
          ? req.files.blueprint_files 
          : [req.files.blueprint_files];

        for (const file of blueprintFiles) {
          await ManufacturingModel.storeBlueprint({
            proposal_id: proposalId,
            developer_id,
            file_name: file.filename,
            file_path: file.path
          });
        }
      }

      res.status(201).json({ 
        success: true, 
        message: "Project proposal submitted successfully",
        proposalId 
      });

    } catch (error) {
      console.error("Error in project creation:", error);
      res.status(500).json({ 
        success: false,
        error: "Failed to create project proposal" 
      });
    }
  },

  getAllProjects: async (req, res) => {
    try {
      const projects = await ManufacturingModel.getAllProjects();
      res.json({
        success: true,
        projects
      });
    } catch (error) {
      console.error("Error fetching projects:", error);
      res.status(500).json({ 
        success: false,
        error: "Failed to fetch projects" 
      });
    }
  },

  getProjectById: async (req, res) => {
    try {
      const projectId = req.params.id;
      const project = await ManufacturingModel.getProjectById(projectId);
      if (!project) {
        return res.status(404).json({ 
          success: false,
          error: "Project not found" 
        });
      }
      res.json({
        success: true,
        project
      });
    } catch (error) {
      console.error("Error fetching project:", error);
      res.status(500).json({ 
        success: false,
        error: "Failed to fetch project" 
      });
    }
  },

  // LABOR: add
  addLabor: async (req, res) => {
    try {
      const proposalId = req.params.id;
      const { developer_id, worker_type_id, manpower_per_unit, unit_description } = req.body;

      if (!developer_id || !worker_type_id || !manpower_per_unit) {
        return res.status(400).json({ success: false, error: "developer_id, worker_type_id, manpower_per_unit are required" });
      }

      const laborId = await ManufacturingModel.storeLabor({
        proposal_id: proposalId,
        developer_id,
        worker_type_id,
        manpower_per_unit: parseInt(manpower_per_unit, 10),
        unit_description: unit_description || null,
      });

      res.json({ success: true, message: "Labor added", laborId });
    } catch (error) {
      console.error("Error adding labor:", error);
      res.status(500).json({ success: false, error: "Failed to add labor" });
    }
  },

  // LABOR: list by proposal
  getLaborByProposal: async (req, res) => {
    try {
      const proposalId = req.params.id;
      const rows = await ManufacturingModel.getLaborByProposal(proposalId);
      res.json({ success: true, labor: rows });
    } catch (error) {
      console.error("Error fetching labor:", error);
      res.status(500).json({ success: false, error: "Failed to fetch labor" });
    }
  },

  // LABOR: update
  updateLabor: async (req, res) => {
    try {
      const laborId = req.params.laborId;
      const { worker_type_id, manpower_per_unit, unit_description } = req.body;
      if (!worker_type_id || !manpower_per_unit) {
        return res.status(400).json({ success: false, error: "worker_type_id and manpower_per_unit are required" });
      }
      await ManufacturingModel.updateLabor(laborId, {
        worker_type_id,
        manpower_per_unit: parseInt(manpower_per_unit, 10),
        unit_description: unit_description || null,
      });
      res.json({ success: true, message: "Labor updated" });
    } catch (error) {
      console.error("Error updating labor:", error);
      res.status(500).json({ success: false, error: "Failed to update labor" });
    }
  },

  // CONSTRUCTION TYPES (formerly worker types): list
  getWorkerTypes: async (req, res) => {
    try {
      const rows = await ManufacturingModel.getWorkerTypes();
      res.json({ success: true, worker_types: rows });
    } catch (error) {
      console.error("Error fetching worker types:", error);
      res.status(500).json({ success: false, error: "Failed to fetch worker types" });
    }
  },

  // LABOR: delete
  deleteLabor: async (req, res) => {
    try {
      const laborId = req.params.laborId;
      await ManufacturingModel.deleteLabor(laborId);
      res.json({ success: true, message: "Labor deleted" });
    } catch (error) {
      console.error("Error deleting labor:", error);
      res.status(500).json({ success: false, error: "Failed to delete labor" });
    }
  },

  updateProject: async (req, res) => {
    try {
      const projectId = req.params.id;
      const {
        project_name,
        location,
        deadline,
        status,
        manufacturing_cost
      } = req.body;

      if (!project_name || !location || !deadline) {
        return res.status(400).json({ 
          success: false,
          error: "All required fields must be filled" 
        });
      }

      let project_image = null;
      if (req.file) {
        project_image = req.file.filename;
      }

      await ManufacturingModel.updateProject(projectId, {
        project_name,
        location,
        deadline,
        status: status || 'pending',
        project_image,
        manufacturing_cost: manufacturing_cost || null
      });

      res.json({ 
        success: true, 
        message: "Project updated successfully" 
      });
    } catch (error) {
      console.error("Error updating project:", error);
      res.status(500).json({ 
        success: false,
        error: "Failed to update project" 
      });
    }
  },

  updateProjectStatus: async (req, res) => {
    try {
      const projectId = req.params.id;
      const { status } = req.body;

      if (!status) {
        return res.status(400).json({ 
          success: false,
          error: "Status is required" 
        });
      }

      await ManufacturingModel.updateProjectStatus(projectId, status);
      res.json({ 
        success: true, 
        message: "Project status updated successfully" 
      });
    } catch (error) {
      console.error("Error updating project status:", error);
      res.status(500).json({ 
        success: false,
        error: "Failed to update project status" 
      });
    }
  },

  updateManufacturingCost: async (req, res) => {
    try {
      const projectId = req.params.id;
      const { manufacturing_cost } = req.body;

      if (!manufacturing_cost || manufacturing_cost <= 0) {
        return res.status(400).json({ 
          success: false,
          error: "Valid manufacturing cost is required" 
        });
      }

      await ManufacturingModel.updateManufacturingCost(projectId, manufacturing_cost);
      res.json({ 
        success: true, 
        message: "Manufacturing cost updated successfully" 
      });
    } catch (error) {
      console.error("Error updating manufacturing cost:", error);
      res.status(500).json({ 
        success: false,
        error: "Failed to update manufacturing cost" 
      });
    }
  },

  // Add supply material
  addSupplyMaterial: async (req, res) => {
    try {
      const projectId = req.params.id;
      const { material_name, unit, quantity, developer_id } = req.body;

      if (!material_name || !quantity || !developer_id) {
        return res.status(400).json({ 
          success: false,
          error: "Material name, quantity, and developer ID are required" 
        });
      }

      const supplyId = await ManufacturingModel.storeSupplyMaterial({
        proposal_id: projectId,
        developer_id,
        material_name,
        unit: unit || '',
        quantity: parseInt(quantity)
      });

      res.json({ 
        success: true, 
        message: "Supply material added successfully",
        supplyId 
      });
    } catch (error) {
      console.error("Error adding supply material:", error);
      res.status(500).json({ 
        success: false,
        error: "Failed to add supply material" 
      });
    }
  },

  // Get supply materials for a project
  getSupplyMaterials: async (req, res) => {
    try {
      const projectId = req.params.id;
      const supplyMaterials = await ManufacturingModel.getSupplyMaterials(projectId);
      res.json({
        success: true,
        supplyMaterials
      });
    } catch (error) {
      console.error("Error fetching supply materials:", error);
      res.status(500).json({ 
        success: false,
        error: "Failed to fetch supply materials" 
      });
    }
  },

  // Update supply material
  updateSupplyMaterial: async (req, res) => {
    try {
      const supplyId = req.params.supplyId;
      const { material_name, unit, quantity } = req.body;

      if (!material_name || !quantity) {
        return res.status(400).json({ 
          success: false,
          error: "Material name and quantity are required" 
        });
      }

      await ManufacturingModel.updateSupplyMaterial(supplyId, {
        material_name,
        unit: unit || '',
        quantity: parseInt(quantity)
      });

      res.json({ 
        success: true, 
        message: "Supply material updated successfully" 
      });
    } catch (error) {
      console.error("Error updating supply material:", error);
      res.status(500).json({ 
        success: false,
        error: "Failed to update supply material" 
      });
    }
  },

  // Delete supply material
  deleteSupplyMaterial: async (req, res) => {
    try {
      const supplyId = req.params.supplyId;
      await ManufacturingModel.deleteSupplyMaterial(supplyId);
      res.json({ 
        success: true, 
        message: "Supply material deleted successfully" 
      });
    } catch (error) {
      console.error("Error deleting supply material:", error);
      res.status(500).json({ 
        success: false,
        error: "Failed to delete supply material" 
      });
    }
  },

  getProjectsByDeveloper: async (req, res) => {
    try {
      const developerId = req.params.developerId;
      const projects = await ManufacturingModel.getProjectsByDeveloper(developerId);
      
      res.json({
        success: true,
        projects
      });
    } catch (error) {
      console.error("❌ ERROR: Error fetching developer projects:", error);
      res.status(500).json({ 
        success: false,
        error: "Failed to fetch developer projects",
        details: error.message
      });
    }
  },

  getProjectsByStatus: async (req, res) => {
    try {
      const status = req.params.status;
      const projects = await ManufacturingModel.getProjectsByStatus(status);
      res.json({
        success: true,
        projects
      });
    } catch (error) {
      console.error("Error fetching projects by status:", error);
      res.status(500).json({ 
        success: false,
        error: "Failed to fetch projects by status" 
      });
    }
  },

  // Create contract
  createContract: async (req, res) => {
    try {
      const { proposal_id, developer_id, contract_date, status } = req.body;

      if (!proposal_id || !developer_id || !contract_date) {
        return res.status(400).json({ 
          success: false,
          error: "proposal_id, developer_id, and contract_date are required" 
        });
      }

      const contractId = await ManufacturingModel.storeContract({
        proposal_id,
        developer_id,
        contract_date,
        status: status || 'Draft'
      });

      // Update proposal status to 'contract_generated'
      await ManufacturingModel.updateProjectStatus(proposal_id, 'contract_generated');

      res.json({ 
        success: true, 
        message: "Contract created successfully",
        contractId 
      });
    } catch (error) {
      console.error("Error creating contract:", error);
      res.status(500).json({ 
        success: false,
        error: "Failed to create contract" 
      });
    }
  },

  // Get contract clauses
  getContractClauses: async (req, res) => {
    try {
      const clauses = await ManufacturingModel.getContractClauses();
      res.json({
        success: true,
        clauses
      });
    } catch (error) {
      console.error("Error fetching contract clauses:", error);
      res.status(500).json({ 
        success: false,
        error: "Failed to fetch contract clauses" 
      });
    }
  },

  // Get all contracts
  getAllContracts: async (req, res) => {
    try {
      const contracts = await ManufacturingModel.getAllContracts();
      res.json({
        success: true,
        contracts
      });
    } catch (error) {
      console.error("Error fetching all contracts:", error);
      res.status(500).json({ 
        success: false,
        error: "Failed to fetch contracts" 
      });
    }
  },

  // Get contracts by developer
  getContractsByDeveloper: async (req, res) => {
    try {
      const developerId = req.params.developerId;
      const contracts = await ManufacturingModel.getContractsByDeveloper(developerId);
      res.json({
        success: true,
        contracts
      });
    } catch (error) {
      console.error("Error fetching developer contracts:", error);
      res.status(500).json({ 
        success: false,
        error: "Failed to fetch contracts" 
      });
    }
  },

  // Get contract by ID
  getContractById: async (req, res) => {
    try {
      const contractId = req.params.contractId;
      const contract = await ManufacturingModel.getContractById(contractId);
      
      if (!contract) {
        return res.status(404).json({ 
          success: false,
          error: "Contract not found" 
        });
      }
      
      res.json({
        success: true,
        contract
      });
    } catch (error) {
      console.error("Error fetching contract:", error);
      res.status(500).json({ 
        success: false,
        error: "Failed to fetch contract" 
      });
    }
  },

  // Sign contract
  signContract: async (req, res) => {
    try {
      const contractId = req.body.contract_id;
      const signatureFile = req.file;

      if (!contractId) {
        return res.status(400).json({ 
          success: false,
          error: "Contract ID is required" 
        });
      }

      if (!signatureFile) {
        return res.status(400).json({ 
          success: false,
          error: "Signature file is required" 
        });
      }

      // Update contract with signature (store only filename, not full path)
      await ManufacturingModel.updateContractSignature(contractId, signatureFile.filename);

      res.json({ 
        success: true, 
        message: "Contract signed successfully" 
      });
    } catch (error) {
      console.error("Error signing contract:", error);
      res.status(500).json({ 
        success: false,
        error: "Failed to sign contract" 
      });
    }
  },

  // Manufacturing sign contract (activates contract)
  manufacturingSignContract: async (req, res) => {
    try {
      const contractId = req.body.contract_id;
      const signatureFile = req.file;

      if (!contractId) {
        return res.status(400).json({ 
          success: false,
          error: "Contract ID is required" 
        });
      }

      if (!signatureFile) {
        return res.status(400).json({ 
          success: false,
          error: "Manufacturing signature file is required" 
        });
      }

      // Update contract with manufacturing signature and set status to Active
      await ManufacturingModel.updateContractManufacturingSignature(contractId, signatureFile.filename);

      res.json({ 
        success: true, 
        message: "Contract activated successfully" 
      });
    } catch (error) {
      console.error("Error activating contract:", error);
      res.status(500).json({ 
        success: false,
        error: "Failed to activate contract" 
      });
    }
  },

  // Get all foremen
  getForemen: async (req, res) => {
    try {
      console.log("Fetching foremen from database...");
      const foremen = await ManufacturingModel.getForemen();
      console.log("Foremen found:", foremen.length);
      console.log("Foremen data:", foremen);
      
      res.json({
        success: true,
        foremen
      });
    } catch (error) {
      console.error("Error fetching foremen:", error);
      res.status(500).json({ 
        success: false,
        error: "Failed to fetch foremen" 
      });
    }
  },

  // Create material request
  createMaterialRequest: async (req, res) => {
    try {
      const { project_id, source_type, purpose, materials } = req.body;
      const requested_by = req.session.user.employee_id;

      if (!project_id || !source_type || !purpose || !materials || materials.length === 0) {
        return res.status(400).json({ 
          success: false,
          error: "All required fields must be filled" 
        });
      }

      // Generate request number
      const year = new Date().getFullYear();
      const requestNo = `RM-${year}-${Date.now().toString().slice(-6)}`;

      // Create material request records
      const requestId = await ManufacturingModel.createMaterialRequest({
        request_no: requestNo,
        project_id,
        requested_by,
        department_id: 3, // Manufacturing department ID
        source_type,
        purpose,
        materials
      });

      res.json({ 
        success: true, 
        message: "Material request submitted successfully",
        requestId,
        requestNo
      });
    } catch (error) {
      console.error("Error creating material request:", error);
      res.status(500).json({ 
        success: false,
        error: "Failed to create material request" 
      });
    }
  },

  // Get manufacturing request materials
  getManufacturingRequestMaterials: async (req, res) => {
    try {
      const requestMaterials = await ManufacturingModel.getManufacturingRequestMaterials();
      res.json({
        success: true,
        requestMaterials
      });
    } catch (error) {
      console.error("Error fetching manufacturing request materials:", error);
      res.status(500).json({ 
        success: false,
        error: "Failed to fetch manufacturing request materials" 
      });
    }
  },

  // Mark materials as received
  markMaterialsReceived: async (req, res) => {
    try {
      const { request_no } = req.body;

      if (!request_no) {
        return res.status(400).json({ 
          success: false,
          error: "Request number is required" 
        });
      }

      const result = await ManufacturingModel.markMaterialsReceived(request_no);

      if (result.success) {
        res.json({
          success: true,
          message: "Materials marked as received successfully"
        });
      } else {
        res.status(400).json({
          success: false,
          error: result.error
        });
      }
    } catch (error) {
      console.error("Error marking materials as received:", error);
      res.status(500).json({ 
        success: false,
        error: "Failed to mark materials as received" 
      });
    }
  },

  // Send labor submission notification email
  sendLaborSubmissionEmail: async (req, res) => {
    try {
      const { project_id, developer_id, estimated_cost } = req.body;

      if (!project_id || !developer_id || !estimated_cost) {
        return res.status(400).json({ 
          success: false,
          error: "Project ID, developer ID, and estimated cost are required" 
        });
      }

      // Get project and developer details
      const project = await ManufacturingModel.getProjectById(project_id);
      if (!project) {
        return res.status(404).json({ 
          success: false,
          error: "Project not found" 
        });
      }

      // Get developer details from the project
      const developerEmail = project.developer_email;
      const developerName = project.developer_company;

      if (!developerEmail) {
        return res.status(400).json({ 
          success: false,
          error: "Developer email not found" 
        });
      }

      // Send email notification
      await sendLaborSubmissionNotification(
        developerEmail,
        developerName || 'Developer',
        project.project_name,
        estimated_cost
      );

      res.json({
        success: true,
        message: "Labor submission notification email sent successfully"
      });

    } catch (error) {
      console.error("Error sending labor submission email:", error);
      res.status(500).json({ 
        success: false,
        error: "Failed to send labor submission notification email" 
      });
    }
  },

  // Handle cost negotiation from developer
  negotiateCost: async (req, res) => {
    try {
      const { project_id, current_cost, reason } = req.body;

      if (!project_id || !reason) {
        return res.status(400).json({ 
          success: false,
          error: "Project ID and reason are required" 
        });
      }

      // Get project details
      const project = await ManufacturingModel.getProjectById(project_id);
      if (!project) {
        return res.status(404).json({ 
          success: false,
          error: "Project not found" 
        });
      }

      // Check if project is in a negotiable state
      if (project.status === 'contract_generated' || project.status === 'developer_approved') {
        return res.status(400).json({ 
          success: false,
          error: "Cost discussion is not available for projects in this status" 
        });
      }

      // Create notification for manufacturing team
      const projectCost = project.estimated_cost;
      
      await Notifications.create({
        departmentId: 3, // Manufacturing department ID
        title: "Cost Discussion Request",
        message: `Developer "${project.developer_company}" has requested to discuss the cost for project "${project.project_name}". Current cost: ₱${projectCost.toLocaleString()}. Reason: ${reason}`,
        type: 'warning'
      });

      res.json({
        success: true,
        message: "Cost discussion request submitted successfully. The manufacturing team will contact you soon."
      });

    } catch (error) {
      console.error("Error processing cost negotiation:", error);
      res.status(500).json({ 
        success: false,
        error: "Failed to process cost discussion request" 
      });
    }
  },

  // Get unread notifications for manufacturing department
  getUnreadNotifications: async (req, res) => {
    try {
      const userId = req.session.user?.id;
      const departmentId = 3; // Manufacturing department ID
      
      const notifications = await Notifications.getUnreadFor({ userId, departmentId, limit: 20 });
      
      res.json({
        success: true,
        notifications
      });
    } catch (error) {
      console.error("Error fetching notifications:", error);
      res.status(500).json({
        success: false,
        error: "Failed to fetch notifications"
      });
    }
  },

  // Mark notification as read
  markNotificationAsRead: async (req, res) => {
    try {
      const notificationId = req.params.id;
      
      const success = await Notifications.markAsRead(notificationId);
      
      if (success) {
        res.json({
          success: true,
          message: "Notification marked as read"
        });
      } else {
        res.status(404).json({
          success: false,
          error: "Notification not found"
        });
      }
    } catch (error) {
      console.error("Error marking notification as read:", error);
      res.status(500).json({
        success: false,
        error: "Failed to mark notification as read"
      });
    }
  },

  // Mark all notifications as read
  markAllNotificationsAsRead: async (req, res) => {
    try {
      const userId = req.session.user?.id;
      const departmentId = 3; // Manufacturing department ID
      
      const affectedRows = await Notifications.markAllAsRead({ userId, departmentId });
      
      res.json({
        success: true,
        message: `${affectedRows} notifications marked as read`
      });
    } catch (error) {
      console.error("Error marking all notifications as read:", error);
      res.status(500).json({
        success: false,
        error: "Failed to mark all notifications as read"
      });
    }
  },

  // ========== CONSTRUCTION WORKERS CONTROLLERS ==========

  getAllConstructionWorkers: async (req, res) => {
    try {
      const workers = await ManufacturingModel.getAllConstructionWorkers();
      res.json(workers);
    } catch (error) {
      console.error('Error getting all construction workers:', error);
      res.status(500).json({ error: 'Failed to get construction workers' });
    }
  },

  getConstructionWorkerById: async (req, res) => {
    try {
      const { workerId } = req.params;
      const worker = await ManufacturingModel.getConstructionWorkerById(workerId);
      
      if (!worker) {
        return res.status(404).json({ error: 'Construction worker not found' });
      }
      
      res.json(worker);
    } catch (error) {
      console.error('Error getting construction worker by ID:', error);
      res.status(500).json({ error: 'Failed to get construction worker' });
    }
  },

  addConstructionWorker: async (req, res) => {
    try {
      const workerData = req.body;
      
      // Add picture filename if uploaded
      if (req.file) {
        workerData.picture = req.file.filename;
      }
      
      // Validate required fields
      const requiredFields = ['firstname', 'lastname', 'role_id', 'project_id'];
      for (const field of requiredFields) {
        if (!workerData[field]) {
          return res.status(400).json({ error: `Missing required field: ${field}` });
        }
      }

      const newWorker = await ManufacturingModel.addConstructionWorker(workerData);
      res.status(201).json(newWorker);
    } catch (error) {
      console.error('Error adding construction worker:', error);
      
      // Check for specific error types
      if (error.message === 'No available manpower for this role in the selected project') {
        return res.status(400).json({ error: 'No available manpower for this role in the selected project' });
      }
      
      // Handle multer errors
      if (error.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: 'File too large. Maximum size is 5MB.' });
      }
      
      if (error.message === 'Only image files are allowed!') {
        return res.status(400).json({ error: 'Only image files (JPG, PNG, GIF) are allowed.' });
      }
      
      res.status(500).json({ error: 'Failed to add construction worker' });
    }
  },

  updateConstructionWorker: async (req, res) => {
    try {
      const { workerId } = req.params;
      const workerData = req.body;
      
      const updated = await ManufacturingModel.updateConstructionWorker(workerId, workerData);
      
      if (!updated) {
        return res.status(404).json({ error: 'Construction worker not found' });
      }
      
      res.json({ message: 'Construction worker updated successfully' });
    } catch (error) {
      console.error('Error updating construction worker:', error);
      res.status(500).json({ error: 'Failed to update construction worker' });
    }
  },

  deleteConstructionWorker: async (req, res) => {
    try {
      const { workerId } = req.params;
      
      const deleted = await ManufacturingModel.deleteConstructionWorker(workerId);
      
      if (!deleted) {
        return res.status(404).json({ error: 'Construction worker not found' });
      }
      
      res.json({ message: 'Construction worker deleted successfully' });
    } catch (error) {
      console.error('Error deleting construction worker:', error);
      res.status(500).json({ error: 'Failed to delete construction worker' });
    }
  },

  getAllConstructionRoles: async (req, res) => {
    try {
      const roles = await ManufacturingModel.getAllConstructionRoles();
      res.json(roles);
    } catch (error) {
      console.error('Error getting all construction roles:', error);
      res.status(500).json({ error: 'Failed to get construction roles' });
    }
  },

  getAllProjects: async (req, res) => {
    try {
      const projects = await ManufacturingModel.getAllProjects();
      res.json(projects);
    } catch (error) {
      console.error('Error getting all projects:', error);
      res.status(500).json({ error: 'Failed to get projects' });
    }
  },

  getProjectLaborRoles: async (req, res) => {
    try {
      const { projectId } = req.params;
      const roles = await ManufacturingModel.getProjectLaborRoles(projectId);
      res.json(roles);
    } catch (error) {
      console.error('Error getting project labor roles:', error);
      res.status(500).json({ error: 'Failed to get project labor roles' });
    }
  },

  // Get labor roles for planning projects
  getLaborRolesForPlanningProjects: async (req, res) => {
    try {
      const { projectId } = req.params;
      const roles = await ManufacturingModel.getLaborRolesForPlanningProjects(projectId);
      res.json(roles);
    } catch (error) {
      console.error('Error getting labor roles for planning projects:', error);
      res.status(500).json({ error: 'Failed to get labor roles for planning projects' });
    }
  },

  // ========== ATTENDANCE CONTROLLERS ==========

  // Scan QR code and get worker details
  scanQRCode: async (req, res) => {
    try {
      const { qrData } = req.body;
      
      if (!qrData) {
        return res.status(400).json({ error: 'QR code data is required' });
      }

      const worker = await ManufacturingModel.getConstructionWorkerByQRCode(qrData);
      
      if (!worker) {
        return res.status(404).json({ error: 'Worker not found or inactive' });
      }

      // Check if worker already has attendance record for today
      const todayAttendance = await ManufacturingModel.checkTodayAttendance(worker.id);
      
      res.json({
        success: true,
        worker: {
          id: worker.id,
          name: `${worker.firstname} ${worker.middlename} ${worker.lastname}`.trim(),
          role: worker.role_name,
          project: worker.project_name,
          project_id: worker.project_id,
          picture: worker.picture,
          unique_code: worker.unique_code
        },
        todayAttendance: todayAttendance ? {
          time_in: todayAttendance.time_in,
          time_out: todayAttendance.time_out,
          status: todayAttendance.status
        } : null
      });
    } catch (error) {
      console.error('Error scanning QR code:', error);
      res.status(500).json({ error: 'Failed to scan QR code' });
    }
  },

  // Record attendance (time in)
  recordAttendance: async (req, res) => {
    try {
      const { workerId, projectId, action } = req.body;
      
      if (!workerId || !projectId || !action) {
        return res.status(400).json({ error: 'Worker ID, Project ID, and action are required' });
      }

      if (action === 'time_in') {
        const attendanceId = await ManufacturingModel.recordTimeIn(workerId, projectId);
        res.json({
          success: true,
          message: 'Time in recorded successfully',
          attendanceId
        });
      } else if (action === 'time_out') {
        const success = await ManufacturingModel.recordTimeOut(workerId);
        if (success) {
          res.json({
            success: true,
            message: 'Time out recorded successfully'
          });
        } else {
          res.status(400).json({ error: 'No time in record found for today' });
        }
      } else {
        res.status(400).json({ error: 'Invalid action. Use "time_in" or "time_out"' });
      }
    } catch (error) {
      console.error('Error recording attendance:', error);
      
      if (error.message === 'Attendance already recorded for today') {
        return res.status(400).json({ error: 'Attendance already recorded for today' });
      }
      
      res.status(500).json({ error: 'Failed to record attendance' });
    }
  },

  // Get worker attendance records
  getWorkerAttendance: async (req, res) => {
    try {
      const { workerId } = req.params;
      const { limit = 30 } = req.query;
      
      const records = await ManufacturingModel.getWorkerAttendanceRecords(workerId, parseInt(limit));
      res.json({
        success: true,
        records
      });
    } catch (error) {
      console.error('Error getting worker attendance:', error);
      res.status(500).json({ error: 'Failed to get worker attendance records' });
    }
  },

  // Get project attendance records
  getProjectAttendance: async (req, res) => {
    try {
      const { projectId } = req.params;
      const { date } = req.query;
      
      const records = await ManufacturingModel.getProjectAttendanceRecords(projectId, date);
      res.json({
        success: true,
        records
      });
    } catch (error) {
      console.error('Error getting project attendance:', error);
      res.status(500).json({ error: 'Failed to get project attendance records' });
    }
  },

  // Get all today's attendance records
  getTodayAttendance: async (req, res) => {
    try {
      const { date } = req.query;
      const targetDate = date || new Date().toISOString().split('T')[0]; // Default to today
      
      const records = await ManufacturingModel.getTodayAttendanceRecords(targetDate);
      res.json({
        success: true,
        records
      });
    } catch (error) {
      console.error('Error getting today attendance:', error);
      res.status(500).json({ error: 'Failed to get today attendance records' });
    }
  }
};

module.exports = { 
  ManufacturingController,
  projectUpload,
  signatureUpload,
  constructionWorkerUpload
};
