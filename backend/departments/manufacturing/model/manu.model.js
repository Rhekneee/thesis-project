const db = require("../../../db");

const ManufacturingModel = {
  // Store proposal
  storeProject: async (data) => {
    try {
      // Check if proposals table exists
      const [tableCheck] = await db.execute("SHOW TABLES LIKE 'proposals'");
      if (tableCheck.length === 0) {
        throw new Error("Proposals table doesn't exist yet. Please create the table first.");
      }

      const query = `
        INSERT INTO proposals (
          project_name,
          location,
          blocks,
          description,
          status,
          developer_id,
          created_at
        ) VALUES (?, ?, ?, ?, ?, ?, NOW())
      `;

      const [result] = await db.execute(query, [
        data.project_name,
        data.location,
        data.blocks,
        data.description,
        data.status || 'pending',
        data.developer_id,
      ]);

      return result.insertId;
    } catch (error) {
      console.error("❌ ERROR: Model - Error in storeProject:", error);
      throw error;
    }
  },

  getAllProjects: async () => {
    const query = `
      SELECT 
        p.*,
        da.company_name as developer_company,
        da.contact_number as developer_contact,
        da.email as developer_email
      FROM proposals p
      LEFT JOIN developer_accounts da ON p.developer_id = da.id
      ORDER BY p.created_at DESC
    `;
    const [rows] = await db.execute(query);
    return rows;
  },

  getProjectById: async (projectId) => {
    const query = `
      SELECT 
        p.*,
        da.company_name as developer_company,
        da.contact_number as developer_contact,
        da.email as developer_email,
        da.company_address as developer_address
      FROM proposals p
      LEFT JOIN developer_accounts da ON p.developer_id = da.id
      WHERE p.proposal_id = ?
    `;
    const [rows] = await db.execute(query, [projectId]);
    const project = rows[0] || null;
    
    if (project) {
      // Fetch blueprint files for this project
      const blueprintQuery = `
        SELECT 
          blueprint_id,
          file_name,
          file_path,
          uploaded_at
        FROM project_blueprints 
        WHERE proposal_id = ?
        ORDER BY uploaded_at DESC
      `;
      const [blueprintRows] = await db.execute(blueprintQuery, [projectId]);
      project.blueprint_files = blueprintRows;

      // Fetch supply materials for this project
      const supplyMaterials = await ManufacturingModel.getSupplyMaterials(projectId);
      project.supply_materials = supplyMaterials;

      // Fetch labor rows for this project (joined with worker_types)
      const laborQuery = `
        SELECT 
          l.labor_id,
          l.worker_type_id,
          ct.name AS worker_type_name,
          l.manpower_per_unit,
          l.unit_description
        FROM labor l
        JOIN construction_types ct ON ct.worker_type_id = l.worker_type_id
        WHERE l.proposal_id = ?
        ORDER BY l.labor_id ASC
      `;
      const [laborRows] = await db.execute(laborQuery, [projectId]);
      project.labor = laborRows;
    }
    
    return project;
  },
  
  // LABOR: store
  storeLabor: async (data) => {
    const query = `
      INSERT INTO labor (
        proposal_id,
        developer_id,
        worker_type_id,
        manpower_per_unit,
        unit_description
      ) VALUES (?, ?, ?, ?, ?)
    `;
    const [result] = await db.execute(query, [
      data.proposal_id,
      data.developer_id,
      data.worker_type_id,
      data.manpower_per_unit,
      data.unit_description || null,
    ]);
    return result.insertId;
  },

  // LABOR: get by proposal
  getLaborByProposal: async (proposalId) => {
    const query = `
      SELECT 
        l.labor_id,
        l.worker_type_id,
        ct.name AS worker_type_name,
        l.manpower_per_unit,
        l.unit_description
      FROM labor l
      JOIN construction_types ct ON ct.worker_type_id = l.worker_type_id
      WHERE l.proposal_id = ?
      ORDER BY l.labor_id ASC
    `;
    const [rows] = await db.execute(query, [proposalId]);
    return rows;
  },

  // LABOR: update
  updateLabor: async (laborId, data) => {
    const query = `
      UPDATE labor
      SET worker_type_id = ?, manpower_per_unit = ?, unit_description = ?
      WHERE labor_id = ?
    `;
    await db.execute(query, [
      data.worker_type_id,
      data.manpower_per_unit,
      data.unit_description || null,
      laborId,
    ]);
  },

  // LABOR: delete
  deleteLabor: async (laborId) => {
    const query = `DELETE FROM labor WHERE labor_id = ?`;
    await db.execute(query, [laborId]);
  },

  // WORKER TYPES: list
  getWorkerTypes: async () => {
    const query = `
      SELECT worker_type_id, name, description
      FROM construction_types
      ORDER BY name ASC
    `;
    const [rows] = await db.execute(query);
    return rows;
  },

  updateProject: async (projectId, data) => {
    const query = `
      UPDATE proposals 
      SET 
        project_name = ?,
        location = ?,
        blocks = ?,
        description = ?,
        status = ?
      WHERE proposal_id = ?
    `;
    await db.execute(query, [
      data.project_name,
      data.location,
      data.blocks,
      data.description,
      data.status,
      projectId,
    ]);
  },

  updateProjectStatus: async (projectId, status) => {
    const query = `
      UPDATE proposals 
      SET 
        status = ?
      WHERE proposal_id = ?
    `;
    await db.execute(query, [status, projectId]);
  },

  updateManufacturingCost: async (projectId, cost) => {
    const query = `
      UPDATE proposals 
      SET 
        estimated_cost = ?
      WHERE proposal_id = ?
    `;
    await db.execute(query, [cost, projectId]);
  },

  // Store supply materials in owners_supply table
  storeSupplyMaterial: async (data) => {
    const query = `
      INSERT INTO owners_supply (
        proposal_id,
        developer_id,
        material_name,
        unit,
        quantity
      ) VALUES (?, ?, ?, ?, ?)
    `;
    const [result] = await db.execute(query, [
      data.proposal_id,
      data.developer_id,
      data.material_name,
      data.unit,
      data.quantity
    ]);
    return result.insertId;
  },

  // Get supply materials for a project
  getSupplyMaterials: async (projectId) => {
    const query = `
      SELECT 
        supply_id,
        material_name,
        unit,
        quantity
      FROM owners_supply 
      WHERE proposal_id = ?
      ORDER BY supply_id ASC
    `;
    const [rows] = await db.execute(query, [projectId]);
    return rows;
  },

  // Delete supply material
  deleteSupplyMaterial: async (supplyId) => {
    const query = `DELETE FROM owners_supply WHERE supply_id = ?`;
    await db.execute(query, [supplyId]);
  },

  // Update supply material
  updateSupplyMaterial: async (supplyId, data) => {
    const query = `
      UPDATE owners_supply 
      SET 
        material_name = ?,
        unit = ?,
        quantity = ?
      WHERE supply_id = ?
    `;
    await db.execute(query, [
      data.material_name,
      data.unit,
      data.quantity,
      supplyId
    ]);
  },

  getProjectsByDeveloper: async (developerId) => {
    try {
      // Check if proposals table exists
      const [tableCheck] = await db.execute("SHOW TABLES LIKE 'proposals'");
      if (tableCheck.length === 0) {
        return [];
      }
      
      const query = `
        SELECT 
          p.*,
          da.company_name as developer_company
        FROM proposals p
        LEFT JOIN developer_accounts da ON p.developer_id = da.id
        WHERE p.developer_id = ?
        ORDER BY p.created_at DESC
      `;
      
      const [rows] = await db.execute(query, [developerId]);
      return rows;
    } catch (error) {
      console.error("❌ ERROR: Model - Error in getProjectsByDeveloper:", error);
      // If table doesn't exist, return empty array instead of throwing error
      if (error.code === 'ER_NO_SUCH_TABLE') {
        return [];
      }
      throw error;
    }
  },

  getProjectsByStatus: async (status) => {
    const query = `
      SELECT 
        p.*,
        da.company_name as developer_company,
        da.contact_number as developer_contact,
        da.email as developer_email
      FROM proposals p
      LEFT JOIN developer_accounts da ON p.developer_id = da.id
      WHERE p.status = ?
      ORDER BY p.created_at DESC
    `;
    const [rows] = await db.execute(query, [status]);
    return rows;
  },

  // Store blueprint files
  storeBlueprint: async (data) => {
    const query = `
      INSERT INTO project_blueprints (
        proposal_id,
        developer_id,
        file_name,
        file_path,
        uploaded_at
      ) VALUES (?, ?, ?, ?, NOW())
    `;

    const [result] = await db.execute(query, [
      data.proposal_id,
      data.developer_id,
      data.file_name,
      data.file_path,
    ]);

    return result.insertId;
  },

  // Store contract
  storeContract: async (data) => {
    const query = `
      INSERT INTO contracts (
        proposal_id,
        developer_id,
        contract_date,
        status,
        created_at
      ) VALUES (?, ?, ?, ?, NOW())
    `;

    const [result] = await db.execute(query, [
      data.proposal_id,
      data.developer_id,
      data.contract_date,
      data.status || 'Draft'
    ]);

    return result.insertId;
  },

  // Get contract clauses
  getContractClauses: async () => {
    const query = `
      SELECT clause_id, clause_section, clause_title, clause_text
      FROM contract_clauses
      WHERE is_active = TRUE
      ORDER BY clause_section ASC
    `;
    const [rows] = await db.execute(query);
    return rows;
  },

  // Get all contracts
  getAllContracts: async () => {
    const query = `
      SELECT 
        c.*,
        p.project_name,
        p.location,
        p.blocks,
        p.estimated_cost,
        da.company_name as developer_company
      FROM contracts c
      LEFT JOIN proposals p ON c.proposal_id = p.proposal_id
      LEFT JOIN developer_accounts da ON c.developer_id = da.id
      ORDER BY c.created_at DESC
    `;
    const [rows] = await db.execute(query);
    return rows;
  },

  // Get contracts by developer
  getContractsByDeveloper: async (developerId) => {
    const query = `
      SELECT 
        c.*,
        p.project_name,
        p.location,
        p.blocks,
        p.estimated_cost,
        da.company_name as developer_company
      FROM contracts c
      LEFT JOIN proposals p ON c.proposal_id = p.proposal_id
      LEFT JOIN developer_accounts da ON c.developer_id = da.id
      WHERE c.developer_id = ?
      ORDER BY c.created_at DESC
    `;
    const [rows] = await db.execute(query, [developerId]);
    return rows;
  },

  // Get contract by ID
  getContractById: async (contractId) => {
    const query = `
      SELECT 
        c.*,
        p.project_name,
        p.location,
        p.blocks,
        p.estimated_cost,
        da.company_name as developer_company
      FROM contracts c
      LEFT JOIN proposals p ON c.proposal_id = p.proposal_id
      LEFT JOIN developer_accounts da ON c.developer_id = da.id
      WHERE c.contract_id = ?
    `;
    const [rows] = await db.execute(query, [contractId]);
    const contract = rows[0] || null;
    
    if (contract && contract.proposal_id) {
      // Fetch supply materials for this project
      const supplyMaterials = await ManufacturingModel.getSupplyMaterials(contract.proposal_id);
      contract.supply_materials = supplyMaterials;

      // Fetch labor rows for this project (joined with worker_types)
      const laborQuery = `
        SELECT 
          l.labor_id,
          l.worker_type_id,
          ct.name AS worker_type_name,
          l.manpower_per_unit,
          l.unit_description
        FROM labor l
        JOIN construction_types ct ON ct.worker_type_id = l.worker_type_id
        WHERE l.proposal_id = ?
        ORDER BY l.labor_id ASC
      `;
      const [laborRows] = await db.execute(laborQuery, [contract.proposal_id]);
      contract.labor = laborRows;
    }
    
    return contract;
  },

  // Update contract signature
  updateContractSignature: async (contractId, signaturePath) => {
    const query = `
      UPDATE contracts 
      SET 
        developer_signature = ?,
        status = 'Approved'
      WHERE contract_id = ?
    `;
    await db.execute(query, [signaturePath, contractId]);
  },

  // Update contract manufacturing signature
  updateContractManufacturingSignature: async (contractId, signaturePath) => {
    const query = `
      UPDATE contracts 
      SET 
        manufacturing_signature = ?,
        status = 'Active'
      WHERE contract_id = ?
    `;
    await db.execute(query, [signaturePath, contractId]);
  }
};

module.exports = ManufacturingModel;
