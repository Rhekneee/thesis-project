const ManufacturingModel = require("../model/manu.model");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const pathConfig = require('../../../utils/pathConfig'); // Import path configuration

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
  }
};

module.exports = { 
  ManufacturingController,
  projectUpload,
  signatureUpload
};
