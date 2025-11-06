const ManufacturingModel = require("../model/manu.model");
const FinanceModel = require('../../finance/model/finance.model');
const db = require("../../../db");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const pathConfig = require('../../../utils/pathConfig'); // Import path configuration
const { sendLaborSubmissionNotification } = require('../../../utils/emailService');
const Notifications = require('../../../models/notification.model');

// Helper function to get today's date in Asia/Manila timezone (YYYY-MM-DD format)
function getTodayDateManila() {
  const now = new Date();
  // Convert to Asia/Manila timezone
  const manilaTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Manila' }));
  const year = manilaTime.getFullYear();
  const month = String(manilaTime.getMonth() + 1).padStart(2, '0');
  const day = String(manilaTime.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Normalize PayMongo environment variables to align with .env keys
const PAYMONGO_SECRET = process.env.PAYMONGO_SECRET_KEY 
  || process.env.PAYMONGO_SECRET 
  || process.env.PAYMONGO_SK;
const PAYMONGO_WEBHOOK_SECRET = process.env.PAYMONGO_WEBHOOK_SECRET 
  || process.env.PAYMONGO_WEBHOOK_KEY 
  || process.env.PAYMONGO_WEBHOOK;

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

// Configure multer for division progress images
const divisionProgressStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, '..', '..', '..', 'uploads', 'division_progress');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `division-progress-${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});

const divisionProgressUpload = multer({
  storage: divisionProgressStorage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: function (req, file, cb) {
    if (!file.originalname.match(/\.(jpg|jpeg|png|gif)$/i)) {
      return cb(new Error('Only image files are allowed!'), false);
    }
    cb(null, true);
  }
});

const ManufacturingController = {
  // INTENDED: Return projects with approved vtour permissions (for CRM typing dropdown)
  getApprovedVtourProjects: async (req, res) => {
    try {
      const rows = await ManufacturingModel.getApprovedVtourProjects();
      return res.json({ success: true, projects: rows });
    } catch (error) {
      console.error('Error in getApprovedVtourProjects:', error);
      return res.status(500).json({ success: false, error: 'Failed to fetch approved vtour projects' });
    }
  },
  // =============================================
  // DASHBOARD KPIs (Manufacturing) - Dedicated Endpoint
  // =============================================
  getDashboardKpis: async (req, res) => {
    try {
      const kpis = await ManufacturingModel.getDashboardKpis();
      return res.json({ success: true, data: kpis });
    } catch (error) {
      console.error('Error in getDashboardKpis:', error);
      return res.status(500).json({ success: false, error: 'Failed to fetch dashboard KPIs' });
    }
  },

  // ===== FOREMAN DASHBOARD ENDPOINTS (INTENDED) =====
  // INTENDED: Total projects by foreman_code (employee_id)
  getForemanProjectCount: async (req, res) => {
    try {
      const foremanCode = req.query.foremanCode || req.session?.user?.employee_id;
      if (!foremanCode) return res.status(400).json({ success: false, error: 'foremanCode is required' });
      const total = await ManufacturingModel.getForemanProjectCount(foremanCode);
      return res.json({ success: true, total });
    } catch (error) {
      console.error('INTENDED: Error in getForemanProjectCount:', error);
      return res.status(500).json({ success: false, error: 'Failed to fetch foreman project count' });
    }
  },

  // INTENDED: Total construction workers for foreman projects
  getForemanWorkersCount: async (req, res) => {
    try {
      const foremanCode = req.query.foremanCode || req.session?.user?.employee_id;
      if (!foremanCode) return res.status(400).json({ success: false, error: 'foremanCode is required' });
      const total = await ManufacturingModel.getForemanWorkersCount(foremanCode);
      return res.json({ success: true, total });
    } catch (error) {
      console.error('INTENDED: Error in getForemanWorkersCount:', error);
      return res.status(500).json({ success: false, error: 'Failed to fetch foreman workers count' });
    }
  },

  // INTENDED: Recent planning projects (limit 5)
  getForemanPlanningProjects: async (req, res) => {
    try {
      const foremanCode = req.query.foremanCode || req.session?.user?.employee_id;
      if (!foremanCode) return res.status(400).json({ success: false, error: 'foremanCode is required' });
      const limit = parseInt(req.query.limit) || 5;
      const rows = await ManufacturingModel.getForemanPlanningProjects(foremanCode, limit);
      return res.json({ success: true, data: rows });
    } catch (error) {
      console.error('INTENDED: Error in getForemanPlanningProjects:', error);
      return res.status(500).json({ success: false, error: 'Failed to fetch planning projects' });
    }
  },

  // INTENDED: Material usage trend (company vs owner) for foreman
  getForemanMaterialUsageTrend: async (req, res) => {
    try {
      const foremanCode = req.query.foremanCode || req.session?.user?.employee_id;
      if (!foremanCode) return res.status(400).json({ success: false, error: 'foremanCode is required' });
      const trend = await ManufacturingModel.getForemanMaterialUsageTrend(foremanCode);
      return res.json({ success: true, data: trend });
    } catch (error) {
      console.error('INTENDED: Error in getForemanMaterialUsageTrend:', error);
      return res.status(500).json({ success: false, error: 'Failed to fetch material usage trend' });
    }
  },
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

  // Owners Supply: mark arrival with quantity and set status (Completed/Partial)
  markOwnerSupplyArrival: async (req, res) => {
    try {
      const items = Array.isArray(req.body?.items) ? req.body.items : [req.body];
      if (!items || items.length === 0) {
        return res.status(400).json({ success: false, error: 'No items provided' });
      }

      // Validate inputs first
      for (const it of items) {
        if (!it || it.supply_id === undefined || it.supply_id === null) {
          return res.status(400).json({ success: false, error: 'supply_id is required for each item' });
        }
        if (it.quantity_arrive === undefined || it.quantity_arrive === null || String(it.quantity_arrive).trim() === '') {
          return res.status(400).json({ success: false, error: 'quantity_arrive is required for each item' });
        }
      }

      const results = [];
      for (const it of items) {
        const result = await ManufacturingModel.markOwnerSupplyArrival({
          supplyId: Number(it.supply_id),
          quantityArrive: Number(it.quantity_arrive)
        });
        results.push({ supply_id: it.supply_id, ...result });
      }

      return res.json({ success: true, results });
    } catch (error) {
      console.error('Error marking owner supply arrival:', error);
      return res.status(500).json({ success: false, error: 'Failed to mark owner supply arrival' });
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

  // Get projects with roles for construction workers
  getProjectsForConstructionWorkers: async (req, res) => {
    try {
      const projects = await ManufacturingModel.getProjectsForConstructionWorkers();
      res.json({
        success: true,
        projects
      });
    } catch (error) {
      console.error('Error getting projects for construction workers:', error);
      res.status(500).json({ 
        success: false,
        error: 'Failed to get projects for construction workers' 
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
      console.error('Error getting all projects:', error);
      res.status(500).json({ success: false, error: 'Failed to get projects' });
    }
  },

  // Get active projects for material requests
  getProjectsForMaterialRequest: async (req, res) => {
    try {
      const projects = await ManufacturingModel.getAllActiveProjects();
      res.json({
        success: true,
        projects
      });
    } catch (error) {
      console.error('Error getting projects for material request:', error);
      res.status(500).json({ 
        success: false,
        error: 'Failed to get projects for material request' 
      });
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
      
      // If no QR data provided, return invalid worker error
      if (!qrData) {
        return res.status(404).json({ error: 'Worker is invalid' });
      }

      const worker = await ManufacturingModel.getConstructionWorkerByQRCode(qrData);
      
      if (!worker) {
        return res.status(404).json({ error: 'Worker is invalid' });
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
      const targetDate = date || getTodayDateManila(); // Use Manila timezone if no date provided
      
      const records = await ManufacturingModel.getTodayAttendanceRecords(targetDate);
      res.json({
        success: true,
        records
      });
    } catch (error) {
      console.error('Error getting today attendance:', error);
      res.status(500).json({ error: 'Failed to get today attendance records' });
    }
  },

  // Get all divisions
  getAllDivisions: async (req, res) => {
    try {
      const divisions = await ManufacturingModel.getAllDivisions();
      res.json({
        success: true,
        divisions
      });
    } catch (error) {
      console.error('Error getting all divisions:', error);
      res.status(500).json({ 
        success: false,
        error: 'Failed to get divisions' 
      });
    }
  },

  // Get projects with billing status for payment overview
  getProjectsWithBillingStatus: async (req, res) => {
    try {
      // If session user is developer, restrict by developer_id
      const user = req.session?.user || {};
      const developerId = (user.role_name === 'developer' || user.role_id === 1) ? user.id : null;
      const projects = await ManufacturingModel.getProjectsWithBillingStatus(developerId);
      res.json({
        success: true,
        projects
      });
    } catch (error) {
      console.error('Error getting projects with billing status:', error);
      res.status(500).json({ 
        success: false,
        error: 'Failed to get projects with billing status' 
      });
    }
  },
  
  getProjectsForProgress: async (req, res) => {
    try {
      // If session user is developer, restrict by developer_id
      const user = req.session?.user || {};
      const developerId = (user.role_name === 'developer' || user.role_id === 1) ? user.id : null;
      const projects = await ManufacturingModel.getProjectsForProgress(developerId);
      res.json({
        success: true,
        projects
      });
    } catch (error) {
      console.error('Error getting projects for progress:', error);
      res.status(500).json({ 
        success: false,
        error: 'Failed to get projects for progress' 
      });
    }
  },

  // Get completed projects for a developer
  getCompletedProjectsByDeveloper: async (req, res) => {
    try {
      // Get developer_id from session
      const user = req.session?.user || {};
      const developerId = user.id;

      if (!developerId) {
        return res.status(401).json({
          success: false,
          error: 'Developer not authenticated'
        });
      }

      const projects = await ManufacturingModel.getCompletedProjectsByDeveloper(developerId);
      
      res.json({
        success: true,
        projects
      });
    } catch (error) {
      console.error('Error getting completed projects:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get completed projects'
      });
    }
  },

  // Save division progress entry for manufacturing progress tracking
  saveDivisionProgress: async (req, res) => {
    try {
      const { projectId, divisionId, progressValue, picture } = req.body;
      const pictureFilename = req.file ? req.file.filename : (picture || null);
      
      console.log('📝 Saving division progress:', { projectId, divisionId, progressValue });
      
      if (!projectId || !divisionId || progressValue === undefined) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields: projectId, divisionId, progressValue'
        });
      }

      const result = await ManufacturingModel.saveDivisionProgressEntry(projectId, divisionId, progressValue, pictureFilename || null);
      
      console.log('✅ Division progress saved with ID:', result.entryId);
      console.log('📊 Overall progress:', result.overallProgress, '%');
      
      // Check if project status is now 'completed'
      const [projectRows] = await db.query('SELECT status FROM projects WHERE id = ?', [projectId]);
      const currentStatus = projectRows && projectRows[0] ? projectRows[0].status : null;
      const isCompleted = currentStatus === 'completed';
      
      res.json({
        success: true,
        entryId: result.entryId,
        overallProgress: result.overallProgress || 0,
        isCompleted,
        message: isCompleted ? 'Division progress saved successfully! 🎉 Project completed (100% overall progress)!' : 'Division progress saved successfully',
        picture: pictureFilename || null
      });
    } catch (error) {
      console.error('❌ Error saving division progress:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to save division progress'
      });
    }
  },

  // Save daily log entry for manufacturing progress tracking
  saveDailyLogProgress: async (req, res) => {
    try {
      const { projectId, divisionName, logDate, description, materials, totalMaterialCost, totalLaborCost, workers } = req.body;
      
      console.log('📝 Saving daily log:', { projectId, divisionName, logDate, description: description?.substring(0, 50) });
      
      if (!projectId || !divisionName || !logDate || !description) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields'
        });
      }

      const logId = await ManufacturingModel.saveDailyLogEntry(projectId, divisionName, logDate, description, materials || [], totalMaterialCost || 0, totalLaborCost || 0, workers || []);
      
      console.log('✅ Daily log saved with ID:', logId);
      
      res.json({
        success: true,
        logId,
        message: 'Daily log saved successfully'
      });
    } catch (error) {
      console.error('❌ Error saving daily log:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to save daily log'
      });
    }
  },

  // Get unbilled date range for a project and division
  getUnbilledDateRange: async (req, res) => {
    try {
      const { projectId } = req.params;
      const { division } = req.query;
      
      if (!projectId || !division) {
        return res.status(400).json({
          success: false,
          error: 'projectId and division are required'
        });
      }
      
      const dateRange = await ManufacturingModel.getUnbilledDateRange(Number(projectId), division);
      
      res.json({
        success: true,
        dateRange
      });
    } catch (error) {
      console.error('Error getting unbilled date range:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get unbilled date range'
      });
    }
  },

  // Get daily logs for a project
  getDailyLogsProgress: async (req, res) => {
    try {
      const { projectId } = req.params;
      
      const logs = await ManufacturingModel.getDailyLogsByProject(projectId);
      
      // Get today's date from server (Manila timezone)
      const todayDate = getTodayDateManila();
      
      res.json({
        success: true,
        logs,
        todayDate // Include server date for frontend filtering
      });
    } catch (error) {
      console.error('Error getting daily logs:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get daily logs'
      });
    }
  },

  // Get materials for project dropdown
  getProjectMaterialsProgress: async (req, res) => {
    try {
      const { projectId } = req.params;
      
      const materials = await ManufacturingModel.getProjectMaterialsDropdown(projectId);
      
      res.json({
        success: true,
        materials
      });
    } catch (error) {
      console.error('Error getting project materials:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get project materials'
      });
    }
  },

  // Get owner supply materials by proposal for request form (Delivered/Partial with is_delivered=true)
  getOwnerSupplyMaterialsByProposal: async (req, res) => {
    try {
      const { proposalId } = req.params;
      if (!proposalId) {
        return res.status(400).json({ success: false, error: 'proposalId is required' });
      }
      const materials = await ManufacturingModel.getOwnerSupplyMaterialsByProposal(Number(proposalId));
      return res.json({ success: true, materials });
    } catch (error) {
      console.error('Error getting owner supply materials by proposal:', error);
      return res.status(500).json({ success: false, error: 'Failed to get owner supply materials' });
    }
  },

  // Get material releases intended for a specific project
  getProjectMaterialReleases: async (req, res) => {
    try {
      const { projectId } = req.params;
      const releases = await ManufacturingModel.getProjectMaterialReleases(projectId);
      res.json({ success: true, releases });
    } catch (error) {
      console.error('Error getting project material releases:', error);
      res.status(500).json({ success: false, error: 'Failed to get project material releases' });
    }
  },

  // Get division progress entries for a project
  getDivisionProgressByProject: async (req, res) => {
    try {
      const { projectId } = req.params;
      
      console.log('📊 Getting division progress for project:', projectId);
      
      const entries = await ManufacturingModel.getDivisionProgressByProject(projectId);
      
      console.log(`✅ Found ${entries.length} division progress entries`);
      
      res.json({
        success: true,
        entries
      });
    } catch (error) {
      console.error('Error getting division progress:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get division progress'
      });
    }
  }
  ,
  // Update a division progress entry (edit modal)
  updateDivisionProgress: async (req, res) => {
    try {
      const entryId = Number(req.params.entryId);
      const { divisionId, progressValue, picture } = req.body || {};
      const pictureFilename = req.file ? req.file.filename : (picture ?? undefined);
      if (!entryId || !divisionId || progressValue === undefined) {
        return res.status(400).json({ success: false, error: 'entryId, divisionId and progressValue are required' });
      }
      const result = await ManufacturingModel.updateDivisionProgressEntry(entryId, {
        divisionId: Number(divisionId),
        progressValue: Number(progressValue),
        picture: pictureFilename === undefined ? (picture || null) : (pictureFilename || null)
      });
      if (!result.success) {
        return res.status(404).json({ success: false, error: 'Division progress entry not found' });
      }
      return res.json({ success: true, picture: (pictureFilename || picture || null) });
    } catch (error) {
      console.error('Error updating division progress entry:', error);
      return res.status(500).json({ success: false, error: 'Failed to update division progress entry' });
    }
  }
  ,
  // Stage billing: list for project
  getStageBillingsByProject: async (req, res) => {
    try {
      const { projectId } = req.params;
      if (!projectId) return res.status(400).json({ success: false, error: 'projectId is required' });
      const rows = await ManufacturingModel.getStageBillingsByProject(Number(projectId));
      return res.json({ success: true, billings: rows });
    } catch (error) {
      console.error('Error getting stage billings by project:', error);
      return res.status(500).json({ success: false, error: 'Failed to get stage billings' });
    }
  }
  ,
  // Stage billing: detailed info
  getStageBillingDetail: async (req, res) => {
    try {
      const { billingId } = req.params;
      if (!billingId) return res.status(400).json({ success: false, error: 'billingId is required' });
      const detail = await ManufacturingModel.getStageBillingDetail(Number(billingId));
      if (!detail) return res.status(404).json({ success: false, error: 'Stage billing not found' });
      return res.json({ success: true, detail });
    } catch (error) {
      console.error('Error getting stage billing detail:', error);
      return res.status(500).json({ success: false, error: 'Failed to get stage billing detail' });
    }
  }
  ,
  // Get aggregated project tracking detail for developer view
  getProjectTrackingDetail: async (req, res) => {
    try {
      const { projectId } = req.params;
      const detail = await ManufacturingModel.getProjectTrackingDetail(projectId);
      res.json({ success: true, detail });
    } catch (error) {
      console.error('Error getting project tracking detail:', error);
      res.status(500).json({ success: false, error: 'Failed to get project tracking detail' });
    }
  }
  ,
  // ==================== PROJECT RATINGS (appended feature) ====================
  // POST /manufacturing/projects/:projectId/rating
  submitProjectRating: async (req, res) => {
    try {
      const projectId = Number(req.params.projectId);
      const developerId = req.session?.user?.id || req.body?.developer_id || null;
      const {
        finishing_quality,
        structural_accuracy,
        timeline_performance,
        client_satisfaction,
        material_efficiency,
        feedback
      } = req.body || {};

      if (!projectId) {
        return res.status(400).json({ success: false, error: 'projectId is required' });
      }

      // Optional: ensure project is completed before rating
      try {
        const [projRows] = await db.query('SELECT status FROM projects WHERE id = ?', [projectId]);
        const status = projRows && projRows[0] ? projRows[0].status : null;
        if (!status) return res.status(404).json({ success: false, error: 'Project not found' });
        // Allow rating only when completed
        if (String(status).toLowerCase() !== 'completed') {
          return res.status(400).json({ success: false, error: 'Project is not completed yet' });
        }
      } catch (_) { /* ignore status check errors */ }

      // Strict one-time rating: reject if already exists for this project+developer
      try {
        const exists = await ManufacturingModel.hasProjectRating({ projectId, developerId });
        if (exists) {
          return res.status(409).json({ success: false, error: 'Rating already submitted for this project' });
        }
      } catch(_) {}

      const id = await ManufacturingModel.upsertProjectRating({
        projectId,
        developerId,
        finishingQuality: finishing_quality,
        structuralAccuracy: structural_accuracy,
        timelinePerformance: timeline_performance,
        clientSatisfaction: client_satisfaction,
        materialEfficiency: material_efficiency,
        feedback
      });
      return res.json({ success: true, id });
    } catch (error) {
      console.error('Error submitting project rating:', error);
      return res.status(500).json({ success: false, error: 'Failed to submit project rating' });
    }
  },

  // GET /manufacturing/projects/:projectId/rating
  getProjectRating: async (req, res) => {
    try {
      const projectId = Number(req.params.projectId);
      const developerId = req.session?.user?.id || null;
      if (!projectId) {
        return res.status(400).json({ success: false, error: 'projectId is required' });
      }
      const row = await ManufacturingModel.getProjectRating({ projectId, developerId });
      return res.json({ success: true, rating: row });
    } catch (error) {
      console.error('Error fetching project rating:', error);
      return res.status(500).json({ success: false, error: 'Failed to fetch project rating' });
    }
  },

  // GET /manufacturing/ratings/summary
  getRatingsSummary: async (req, res) => {
    try {
      // Optional range filtering
      const { range, start_date, end_date } = req.query || {};
      let start = null, end = null;
      const now = new Date();
      if (range === 'week') {
        end = new Date(now);
        start = new Date(now);
        start.setDate(start.getDate() - 7);
      } else if (range === 'month') {
        end = new Date(now);
        start = new Date(now);
        start.setDate(start.getDate() - 30);
      } else if (range === 'year') {
        end = new Date(now);
        start = new Date(now);
        start.setDate(start.getDate() - 365);
      } else if (start_date && end_date) {
        start = new Date(start_date);
        end = new Date(end_date);
      }
      const fmt = (d) => d ? new Date(d).toISOString().slice(0, 19).replace('T', ' ') : null;
      const input = (start && end) ? { startDate: fmt(start), endDate: fmt(end) } : {};

      const summary = await ManufacturingModel.getRatingsSummaryByDeveloper(input);
      const overall = await ManufacturingModel.getRatingsOverallAverages(input);
      return res.json({ success: true, summary, overall });
    } catch (error) {
      console.error('Error fetching ratings summary:', error);
      return res.status(500).json({ success: false, error: 'Failed to fetch ratings summary' });
    }
  },

  // GET /manufacturing/developers/:developerId/completed-projects
  getCompletedProjectsForDeveloperId: async (req, res) => {
    try {
      const developerId = Number(req.params.developerId);
      if (!developerId) return res.status(400).json({ success: false, error: 'developerId is required' });
      const projects = await ManufacturingModel.getCompletedProjectsByDeveloper(developerId);
      return res.json({ success: true, projects });
    } catch (error) {
      console.error('Error fetching completed projects for developer:', error);
      return res.status(500).json({ success: false, error: 'Failed to fetch completed projects' });
    }
  },
  /**
   * Store Stage Billing Summary
   *
   * This endpoint persists a single stage billing summary into stage_billing_summary.
   * Request body must include:
   *   - project_id: number
   *   - start_date, end_date: ISO yyyy-mm-dd
   *   - progress_percent: number (e.g. 35 for 35%)
   *   - total_material_cost: number (front-end computed from daily logs/materials)
   *   - remarks: optional string
   *
   * Backend computes labor_cost by summing payslips within [start_date, end_date] for the project.
   */
  createStageBilling: async (req, res) => {
    try {
      const { project_id, division_id, start_date, end_date, progress_percent, total_material_cost, remarks } = req.body || {};
      if (!project_id || !start_date || !end_date) {
        return res.status(400).json({ success: false, error: 'project_id, start_date, end_date are required' });
      }
      const result = await ManufacturingModel.createStageBillingSummary({
        projectId: Number(project_id),
        divisionId: Number(division_id || 0),
        startDate: start_date,
        endDate: end_date,
        progressPercent: Number(progress_percent || 0),
        overallProgressPercent: Number(req.body?.overall_division_progress || 0),
        totalMaterialCost: Number(total_material_cost || 0),
        remarks: remarks || null
      });
      return res.json({ success: true, ...result });
    } catch (error) {
      console.error('Error creating stage billing summary:', error);
      return res.status(500).json({ success: false, error: 'Failed to create stage billing summary' });
    }
  }
  ,
  /**
   * Compute labor cost for a project within [start_date, end_date].
   */
  getLaborCostForRange: async (req, res) => {
    try {
      const { projectId } = req.params;
      const { start_date, end_date } = req.query;
      if (!projectId || !start_date || !end_date) {
        return res.status(400).json({ success: false, error: 'projectId, start_date, end_date are required' });
      }
      const cost = await ManufacturingModel.getLaborCostForRange(Number(projectId), start_date, end_date);
      return res.json({ success: true, labor_cost: cost });
    } catch (error) {
      console.error('Error getting labor cost for range:', error);
      return res.status(500).json({ success: false, error: 'Failed to compute labor cost' });
    }
  },

  /**
   * Get labor cost breakdown by role for stage billing (NEW endpoint)
   * Returns breakdown showing role name, count of workers, and basic salary
   */
  getLaborCostBreakdownByRole: async (req, res) => {
    try {
      const { projectId } = req.params;
      const { start_date, end_date } = req.query;
      if (!projectId || !start_date || !end_date) {
        return res.status(400).json({ success: false, error: 'projectId, start_date, end_date are required' });
      }
      const breakdown = await ManufacturingModel.getLaborCostBreakdownByRole(Number(projectId), start_date, end_date);
      return res.json({ success: true, breakdown });
    } catch (error) {
      console.error('Error getting labor cost breakdown by role:', error);
      return res.status(500).json({ success: false, error: 'Failed to get labor cost breakdown' });
    }
  },
  
  /**
   * Process payment for stage billing
   * Handles both manual (with proof) and online (Stripe) payments
   */
  processPayment: async (req, res) => {
    try {
      const { billing_id, payment_method, reference, remarks, amount } = req.body;
      
      if (!billing_id || !amount) {
        return res.status(400).json({ success: false, error: 'billing_id and amount are required' });
      }
      
      // For manual payments, proof file is required
      let proofFilePath = null;
      if (req.file) {
        proofFilePath = `/uploads/payment_proofs/${req.file.filename}`;
      }
      
      // Store payment record
      await ManufacturingModel.storePaymentRecord({
        billingId: Number(billing_id),
        paymentMethod: payment_method || 'Manual',
        paymentReference: reference || null,
        amountPaid: Number(amount),
        remarks: remarks || null,
        proofFilePath: proofFilePath
      });
      
      // Record payment as cash inflow in cash monitoring
      try {
        await FinanceModel.insertCashMonitoringInflow({
          inflow_source: 'stage_billing_payment',
          amount: Number(amount),
          payment_method: payment_method || 'manual',
          reference_number: reference || null,
          description: `Stage billing payment - ${remarks || 'No remarks'}`,
          recorded_by: 'system:manual_payment',
          transaction_date: new Date()
        });
        console.log('✅ Cash inflow recorded for manual payment');
      } catch (cashError) {
        // Log but don't fail the payment if cash monitoring fails
        console.error('⚠️ Failed to record cash inflow:', cashError);
      }
      
      return res.json({ success: true, message: 'Payment processed successfully' });
    } catch (error) {
      console.error('Error processing payment:', error);
      return res.status(500).json({ success: false, error: 'Failed to process payment' });
    }
  },
  
  /**
   * Create PayMongo payment intent
   * This creates a payment intent on PayMongo and returns the checkout URL
   * Real API integration with PayMongo - redirects user to PayMongo Checkout
   */
  createPaymentIntent: async (req, res) => {
    try {
      const { billing_id, amount, reference, remarks } = req.body;
      
      if (!billing_id || !amount) {
        return res.status(400).json({ success: false, error: 'billing_id and amount are required' });
      }
      
      // Check if PayMongo is configured
      if (!PAYMONGO_SECRET) {
        return res.status(500).json({ 
          success: false, 
          error: 'PayMongo is not configured. Please set PAYMONGO_SECRET_KEY in environment variables.' 
        });
      }

      // Initialize PayMongo client
      const Paymongo = require('paymongo');
      const client = new Paymongo(PAYMONGO_SECRET);
      
      // Create PayMongo Checkout Link
      const checkout = await client.links.create({
        data: {
          attributes: {
            amount: Math.round(amount * 100), // Amount in centavos
            currency: 'PHP',
            description: remarks || 'Payment for stage billing',
            remark: `Stage Billing Payment - ${reference || 'N/A'}`,
            reference_number: reference || '',
            metadata: {
              billing_id: billing_id.toString(),
              reference: reference || '',
              remarks: remarks || ''
            }
          }
        }
      });
      
      // Persist checkout session metadata for reconciliation
      try {
        await ManufacturingModel.savePaymongoCheckoutSession({
          sessionId: checkout.data.id,
          billingId: Number(billing_id),
          amount: Number(amount),
          reference: reference || null,
          remarks: remarks || null,
          url: checkout.data.attributes.checkout_url,
          status: checkout.data.attributes.status || 'created'
        });
      } catch (persistErr) {
        console.warn('Failed to persist PayMongo session:', persistErr.message);
      }

      // Return the checkout URL for frontend to redirect
      return res.json({ 
        success: true,
        url: checkout.data.attributes.checkout_url, // This is the PayMongo Checkout URL
        session_id: checkout.data.id,
        client_secret: checkout.data.id // For compatibility
      });
      
    } catch (error) {
      console.error('Error creating PayMongo payment intent:', error);
      return res.status(500).json({ 
        success: false, 
        error: 'Failed to create payment intent',
        details: error.message 
      });
    }
  },

  /**
   * Handle PayMongo webhook for payment confirmation
   * This endpoint receives webhooks from PayMongo when payment is completed
   * Verifies PayMongo webhook signature and processes payment events
   */
  paymongoWebhook: async (req, res) => {
    try {
      console.log('🔔 PayMongo webhook received');
      
      // PayMongo webhook verification
      const payload = req.body;
      const headers = req.headers;
      
      console.log('📦 Event type:', payload.type);
      console.log('📦 Event data:', JSON.stringify(payload, null, 2));
      
      // Verify webhook signature if webhook secret is set
      const crypto = require('crypto');
      const signature = headers['paymongo-signature'];
      const secret = PAYMONGO_WEBHOOK_SECRET;
      
      if (secret && signature) {
        const hash = crypto
          .createHmac('sha256', secret)
          .update(JSON.stringify(payload))
          .digest('hex');

        if (signature !== hash) {
          console.error('⚠️ Webhook signature verification failed');
          return res.status(400).json({ error: 'Invalid signature' });
        }
        console.log('✅ Webhook signature verified');
      } else {
        console.log('⚠️ Webhook secret not configured, skipping signature verification');
      }

      // Persist raw event payload for traceability
      try {
        await ManufacturingModel.savePaymongoWebhookEvent({
          eventId: payload.id || null,
          type: payload.type || 'unknown',
          payloadJson: JSON.stringify(payload)
        });
      } catch (persistWebhookErr) {
        console.warn('Failed to persist PayMongo webhook event:', persistWebhookErr.message);
      }

      // Handle the event
      const eventType = payload.type;
      
      // Handle Payment Paid event (most common)
      if (eventType === 'payment.paid') {
        const payment = payload.data.attributes;
        const paymentData = payload.data;
        
        console.log('✅ Payment.paid event received');
        console.log('💰 Payment ID:', paymentData.id);
        console.log('💰 Amount:', payment.amount);
        console.log('💰 Status:', payment.status);
        console.log('📋 Full payload:', JSON.stringify(payload, null, 2));
        
        // Extract metadata from multiple possible locations in PayMongo webhook
        let billingId = null;
        if (payment.metadata && payment.metadata.billing_id) {
          billingId = payment.metadata.billing_id;
        } else if (paymentData.attributes && paymentData.attributes.metadata && paymentData.attributes.metadata.billing_id) {
          billingId = paymentData.attributes.metadata.billing_id;
        } else if (payload.data && payload.data.attributes && payload.data.attributes.metadata && payload.data.attributes.metadata.billing_id) {
          billingId = payload.data.attributes.metadata.billing_id;
        } else if (paymentData && paymentData.metadata && paymentData.metadata.billing_id) {
          billingId = paymentData.metadata.billing_id;
        }
        
        // Try to get billing_id from paymongo_sessions table as fallback
        if (!billingId && paymentData.id) {
          try {
            const [sessionRows] = await db.query(`
              SELECT stage_billing_id 
              FROM paymongo_sessions 
              WHERE session_id = ? 
              ORDER BY created_at DESC 
              LIMIT 1
            `, [paymentData.id]);
            if (sessionRows && sessionRows.length > 0) {
              billingId = sessionRows[0].stage_billing_id;
              console.log('📋 Found billing_id from paymongo_sessions:', billingId);
            }
          } catch (sessionErr) {
            console.warn('Could not query paymongo_sessions:', sessionErr.message);
          }
        }
        
        const amountPaid = payment.amount / 100; // Convert from centavos to pesos
        
        console.log('💳 Extracted billing_id:', billingId);
        console.log('💳 Amount paid:', amountPaid);
        
        if (billingId) {
          try {
            // Check if payment already exists
            const existingPayments = await ManufacturingModel.getPaymentsByReference(paymentData.id);
            
            if (existingPayments.length === 0) {
              // Store payment record in database (this will update status to Paid if amount matches)
              await ManufacturingModel.storePaymentRecord({
                billingId: Number(billingId),
                paymentMethod: 'paymongo',
                paymentReference: paymentData.id,
                amountPaid: amountPaid,
                remarks: `PayMongo payment completed - Payment ID: ${paymentData.id}`
              });
              
              // Explicitly update status to 'Paid' in stage_billing_summary
              // This ensures status is updated even if there are edge cases
              try {
                const [billingRows] = await db.query(`
                  SELECT amount_due FROM stage_billing_summary WHERE id = ?
                `, [Number(billingId)]);
                
                if (billingRows && billingRows.length > 0) {
                  const amountDue = Number(billingRows[0].amount_due || 0);
                  const totalPaid = await ManufacturingModel.getTotalPaidAmount(Number(billingId));
                  
                  // Update status to 'Paid' if payment amount matches or exceeds amount due
                  if (totalPaid >= amountDue) {
                    await db.query(`
                      UPDATE stage_billing_summary 
                      SET billing_status = 'Paid' 
                      WHERE id = ?
                    `, [Number(billingId)]);
                    console.log('✅ Billing status updated to Paid in stage_billing_summary');
                  } else if (totalPaid > 0) {
                    await db.query(`
                      UPDATE stage_billing_summary 
                      SET billing_status = 'Partially Paid' 
                      WHERE id = ?
                    `, [Number(billingId)]);
                    console.log('✅ Billing status updated to Partially Paid in stage_billing_summary');
                  }
                }
              } catch (statusErr) {
                console.error('❌ Error updating billing status:', statusErr);
              }
              
              console.log('✅ Payment record stored successfully in database');
            } else {
              console.log('⚠️ Payment already recorded in database');
            }
          } catch (dbError) {
            console.error('❌ Error storing payment record:', dbError);
          }
        } else {
          console.log('⚠️ No billing_id found in metadata, cannot process payment');
        }
      } 
      // Handle Checkout Session Payment Paid event
      else if (eventType === 'checkout.payment.paid') {
        const checkout = payload.data.attributes;
        const checkoutData = payload.data;
        
        console.log('✅ Checkout.payment.paid event received');
        console.log('🛒 Checkout ID:', checkoutData.id);
        console.log('💰 Amount:', checkout.amount);
        console.log('📋 Full payload:', JSON.stringify(payload, null, 2));
        
        // Extract metadata from multiple possible locations in PayMongo webhook
        let billingId = null;
        if (checkout.metadata && checkout.metadata.billing_id) {
          billingId = checkout.metadata.billing_id;
        } else if (checkoutData.attributes && checkoutData.attributes.metadata && checkoutData.attributes.metadata.billing_id) {
          billingId = checkoutData.attributes.metadata.billing_id;
        } else if (payload.data && payload.data.attributes && payload.data.attributes.metadata && payload.data.attributes.metadata.billing_id) {
          billingId = payload.data.attributes.metadata.billing_id;
        } else if (checkoutData && checkoutData.metadata && checkoutData.metadata.billing_id) {
          billingId = checkoutData.metadata.billing_id;
        }
        
        // Try to get billing_id from paymongo_sessions table as fallback
        if (!billingId && checkoutData.id) {
          try {
            const [sessionRows] = await db.query(`
              SELECT stage_billing_id 
              FROM paymongo_sessions 
              WHERE session_id = ? 
              ORDER BY created_at DESC 
              LIMIT 1
            `, [checkoutData.id]);
            if (sessionRows && sessionRows.length > 0) {
              billingId = sessionRows[0].stage_billing_id;
              console.log('📋 Found billing_id from paymongo_sessions:', billingId);
            }
          } catch (sessionErr) {
            console.warn('Could not query paymongo_sessions:', sessionErr.message);
          }
        }
        
        const amountPaid = checkout.amount / 100; // Convert from centavos to pesos
        
        console.log('💳 Extracted billing_id:', billingId);
        console.log('💳 Amount paid:', amountPaid);
        
        if (billingId) {
          try {
            // Check if payment already exists
            const existingPayments = await ManufacturingModel.getPaymentsByReference(checkoutData.id);
            
            if (existingPayments.length === 0) {
              // Store payment record in database (this will update status to Paid if amount matches)
              await ManufacturingModel.storePaymentRecord({
                billingId: Number(billingId),
                paymentMethod: 'paymongo',
                paymentReference: checkoutData.id,
                amountPaid: amountPaid,
                remarks: `PayMongo checkout payment completed - Checkout ID: ${checkoutData.id}`
              });
              
              // Explicitly update status to 'Paid' in stage_billing_summary
              // This ensures status is updated even if there are edge cases
              try {
                const [billingRows] = await db.query(`
                  SELECT amount_due FROM stage_billing_summary WHERE id = ?
                `, [Number(billingId)]);
                
                if (billingRows && billingRows.length > 0) {
                  const amountDue = Number(billingRows[0].amount_due || 0);
                  const totalPaid = await ManufacturingModel.getTotalPaidAmount(Number(billingId));
                  
                  // Update status to 'Paid' if payment amount matches or exceeds amount due
                  if (totalPaid >= amountDue) {
                    await db.query(`
                      UPDATE stage_billing_summary 
                      SET billing_status = 'Paid' 
                      WHERE id = ?
                    `, [Number(billingId)]);
                    console.log('✅ Billing status updated to Paid in stage_billing_summary');
                  } else if (totalPaid > 0) {
                    await db.query(`
                      UPDATE stage_billing_summary 
                      SET billing_status = 'Partially Paid' 
                      WHERE id = ?
                    `, [Number(billingId)]);
                    console.log('✅ Billing status updated to Partially Paid in stage_billing_summary');
                  }
                }
              } catch (statusErr) {
                console.error('❌ Error updating billing status:', statusErr);
              }
              
              console.log('✅ Payment record stored successfully in database');
            } else {
              console.log('⚠️ Payment already recorded in database');
            }
          } catch (dbError) {
            console.error('❌ Error storing payment record:', dbError);
          }
        } else {
          console.log('⚠️ No billing_id found in metadata, cannot process payment');
        }
      } 
      // Handle Link Payment events
      else if (eventType === 'link.payment.paid') {
        const link = payload.data.attributes;
        const linkData = payload.data;
        
        console.log('✅ Link.payment.paid event received');
        console.log('🔗 Link ID:', linkData.id);
        console.log('💰 Amount:', link.amount);
        console.log('📋 Full payload:', JSON.stringify(payload, null, 2));
        
        // Extract metadata from multiple possible locations in PayMongo webhook
        let billingId = null;
        if (link.metadata && link.metadata.billing_id) {
          billingId = link.metadata.billing_id;
        } else if (linkData.attributes && linkData.attributes.metadata && linkData.attributes.metadata.billing_id) {
          billingId = linkData.attributes.metadata.billing_id;
        } else if (payload.data && payload.data.attributes && payload.data.attributes.metadata && payload.data.attributes.metadata.billing_id) {
          billingId = payload.data.attributes.metadata.billing_id;
        } else if (linkData && linkData.metadata && linkData.metadata.billing_id) {
          billingId = linkData.metadata.billing_id;
        }
        
        // Try to get billing_id from paymongo_sessions table as fallback
        if (!billingId && linkData.id) {
          try {
            const [sessionRows] = await db.query(`
              SELECT stage_billing_id 
              FROM paymongo_sessions 
              WHERE session_id = ? 
              ORDER BY created_at DESC 
              LIMIT 1
            `, [linkData.id]);
            if (sessionRows && sessionRows.length > 0) {
              billingId = sessionRows[0].stage_billing_id;
              console.log('📋 Found billing_id from paymongo_sessions:', billingId);
            }
          } catch (sessionErr) {
            console.warn('Could not query paymongo_sessions:', sessionErr.message);
          }
        }
        
        const amountPaid = link.amount / 100; // Convert from centavos to pesos
        
        console.log('💳 Extracted billing_id:', billingId);
        console.log('💳 Amount paid:', amountPaid);
        
        if (billingId) {
          try {
            // Check if payment already exists
            const existingPayments = await ManufacturingModel.getPaymentsByReference(linkData.id);
            
            if (existingPayments.length === 0) {
              // Store payment record in database (this will update status to Paid if amount matches)
              await ManufacturingModel.storePaymentRecord({
                billingId: Number(billingId),
                paymentMethod: 'paymongo',
                paymentReference: linkData.id,
                amountPaid: amountPaid,
                remarks: `PayMongo link payment completed - Link ID: ${linkData.id}`
              });
              
              // Explicitly update status to 'Paid' in stage_billing_summary
              // This ensures status is updated even if there are edge cases
              try {
                const [billingRows] = await db.query(`
                  SELECT amount_due FROM stage_billing_summary WHERE id = ?
                `, [Number(billingId)]);
                
                if (billingRows && billingRows.length > 0) {
                  const amountDue = Number(billingRows[0].amount_due || 0);
                  const totalPaid = await ManufacturingModel.getTotalPaidAmount(Number(billingId));
                  
                  // Update status to 'Paid' if payment amount matches or exceeds amount due
                  if (totalPaid >= amountDue) {
                    await db.query(`
                      UPDATE stage_billing_summary 
                      SET billing_status = 'Paid' 
                      WHERE id = ?
                    `, [Number(billingId)]);
                    console.log('✅ Billing status updated to Paid in stage_billing_summary');
                  } else if (totalPaid > 0) {
                    await db.query(`
                      UPDATE stage_billing_summary 
                      SET billing_status = 'Partially Paid' 
                      WHERE id = ?
                    `, [Number(billingId)]);
                    console.log('✅ Billing status updated to Partially Paid in stage_billing_summary');
                  }
                }
              } catch (statusErr) {
                console.error('❌ Error updating billing status:', statusErr);
              }
              
              console.log('✅ Payment record stored successfully in database');
            } else {
              console.log('⚠️ Payment already recorded in database');
            }
          } catch (dbError) {
            console.error('❌ Error storing payment record:', dbError);
          }
        } else {
          console.log('⚠️ No billing_id found in metadata, cannot process payment');
        }
      } else {
        console.log('ℹ️ Unhandled event type:', eventType);
      }

      // Return a 200 response to acknowledge receipt of the event
      res.json({ received: true, event: eventType });
    } catch (err) {
      console.error('⚠️ Webhook error:', err.message);
      console.error('❌ Full error:', err);
      return res.status(400).json({ error: `Webhook Error: ${err.message}` });
    }
  },

  /**
   * Handle successful payment callback from PayMongo
   */
  paymentSuccess: async (req, res) => {
    try {
      const { checkout_session_id, billing_id } = req.query;
      
      if (!billing_id) {
        return res.status(400).json({ success: false, error: 'Missing billing_id parameter' });
      }

      if (checkout_session_id) {
        // Verify the payment with PayMongo
        const Paymongo = require('paymongo');
        const client = new Paymongo(PAYMONGO_SECRET);
        
        try {
          const checkout = await client.links.retrieve(checkout_session_id);
          
          if (checkout.data.attributes.status === 'paid') {
            // Payment is verified, redirect to success page
            return res.redirect(`/manufacturing/billing/success?billing_id=${billing_id}`);
          } else {
            return res.redirect(`/manufacturing/billing/failed?billing_id=${billing_id}`);
          }
        } catch (verifyError) {
          console.error('Error verifying checkout:', verifyError);
          // Still redirect to success page as webhook will handle the payment recording
          return res.redirect(`/manufacturing/billing/success?billing_id=${billing_id}`);
        }
      } else {
        // No checkout session ID, just redirect to success
        return res.redirect(`/manufacturing/billing/success?billing_id=${billing_id}`);
      }
    } catch (error) {
      console.error('Error in payment success callback:', error);
      return res.redirect(`/manufacturing/billing/failed?error=${error.message}`);
    }
  },

  /**
   * Handle cancelled payment callback from PayMongo
   */
  paymentCancel: async (req, res) => {
    try {
      const { billing_id } = req.query;
      return res.redirect(`/manufacturing/billing?billing_id=${billing_id}&cancelled=true`);
    } catch (error) {
      console.error('Error in payment cancel callback:', error);
      return res.status(500).json({ success: false, error: 'Payment cancellation error' });
    }
  },

  /**
   * Submit vtour permission request
   */
  submitVtourPermission: async (req, res) => {
    try {
      const { developer_id, project_id, remarks } = req.body;
      
      if (!developer_id || !project_id) {
        return res.status(400).json({ success: false, message: 'Developer ID and Project ID are required.' });
      }

      const permissionId = await ManufacturingModel.createVtourPermission({
        developer_id,
        project_id,
        remarks
      });

      res.json({ success: true, message: 'Permission request submitted successfully', id: permissionId });
    } catch (error) {
      console.error('Error submitting vtour permission:', error);
      
      // Handle special case for existing pending permissions
      if (error.code === 'PENDING_EXISTS') {
        return res.status(400).json({ 
          success: false, 
          message: error.message 
        });
      }
      
      res.status(500).json({ 
        success: false, 
        message: error.message || 'Failed to submit permission request' 
      });
    }
  },

  /**
   * Get vtour permissions for a developer
   */
  getVtourPermissionsByDeveloper: async (req, res) => {
    try {
      const user = req.session?.user || {};
      const developerId = user.id;

      if (!developerId) {
        return res.status(401).json({
          success: false,
          error: 'Developer not authenticated'
        });
      }

      const permissions = await ManufacturingModel.getVtourPermissionsByDeveloper(developerId);
      
      res.json({
        success: true,
        permissions
      });
    } catch (error) {
      console.error('Error getting vtour permissions:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get vtour permissions'
      });
    }
  },

  /**
   * Get monitoring table for used supply (INTENDED: For Requested Materials section display only)
   * INTENDED: Dedicated endpoint for Requested Materials monitoring table
   */
  getMonitoringTableForUsedSupply: async (req, res) => {
    try {
      const { projectId } = req.params;
      if (!projectId) {
        return res.status(400).json({ success: false, error: 'projectId is required' });
      }
      
      const materials = await ManufacturingModel.getMonitoringTableForUsedSupply(Number(projectId));
      
      res.json({
        success: true,
        materials
      });
    } catch (error) {
      console.error('Error getting monitoring table for used supply:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get monitoring table for used supply'
      });
    }
  }
  ,
  /**
   * Update vtour permission status
   */
  updateVtourPermissionStatus: async (req, res) => {
    try {
      const permissionId = Number(req.params.permissionId);
      const { status, remarks, reason } = req.body;

      if (!permissionId || !status) {
        return res.status(400).json({
          success: false,
          error: 'Permission ID and status are required'
        });
      }

      if (!['approved', 'denied'].includes(status)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid status. Must be "approved" or "denied"'
        });
      }

      // Pass undefined if remarks/reason not provided (they will be preserved in DB)
      const updated = await ManufacturingModel.updateVtourPermissionStatus(
        permissionId, 
        status, 
        remarks !== undefined ? remarks : undefined, 
        reason !== undefined ? reason : undefined
      );

      if (!updated) {
        return res.status(404).json({
          success: false,
          error: 'Permission not found'
        });
      }

      res.json({
        success: true,
        message: `Permission ${status === 'approved' ? 'approved' : 'rejected'} successfully`
      });
    } catch (error) {
      console.error('Error updating vtour permission status:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update permission status'
      });
    }
  }
  ,
  // INTENDED: Developer view - list daily logs for a project
  getDeveloperDailyLogs: async (req, res) => {
    try {
      const { projectId } = req.params;
      if (!projectId) return res.status(400).json({ success: false, error: 'projectId is required' });
      const logs = await ManufacturingModel.getDeveloperDailyLogs(Number(projectId));
      return res.json({ success: true, logs });
    } catch (error) {
      console.error('INTENDED: Error getting developer daily logs:', error);
      return res.status(500).json({ success: false, error: 'Failed to get developer daily logs' });
    }
  }
  ,
  // INTENDED: Developer view - daily log detail (materials + labor breakdown)
  getDeveloperDailyLogDetail: async (req, res) => {
    try {
      const { logId } = req.params;
      if (!logId) return res.status(400).json({ success: false, error: 'logId is required' });
      const detail = await ManufacturingModel.getDeveloperDailyLogDetail(Number(logId));
      if (!detail) return res.status(404).json({ success: false, error: 'Daily log not found' });
      return res.json({ success: true, detail });
    } catch (error) {
      console.error('INTENDED: Error getting developer daily log detail:', error);
      return res.status(500).json({ success: false, error: 'Failed to get developer daily log detail' });
    }
  }
};

module.exports = { 
  ManufacturingController,
  projectUpload,
  signatureUpload,
  constructionWorkerUpload,
  divisionProgressUpload
};
