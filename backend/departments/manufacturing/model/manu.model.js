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
        pr.id,
        pr.project_code,
        pr.project_name,
        pr.client_name,
        pr.location,
        pr.start_date,
        pr.end_date,
        pr.status,
        pr.foreman_code,
        pr.created_at,
        pr.updated_at,
        p.proposal_id,
        da.company_name as developer_company,
        da.contact_number as developer_contact,
        da.email as developer_email
      FROM projects pr
      LEFT JOIN proposals p ON pr.project_name = p.project_name AND pr.location = p.location
      LEFT JOIN developer_accounts da ON p.developer_id = da.id
      WHERE pr.status = 'planning' OR pr.status = 'ongoing'
      ORDER BY pr.created_at DESC
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
    
    // Create project record when contract becomes active
    await ManufacturingModel.createProjectFromContract(contractId);
  },

  // Create project record from active contract
  createProjectFromContract: async (contractId) => {
    try {
      // Get contract details with proposal and developer info
      const contractQuery = `
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
      const [contractRows] = await db.execute(contractQuery, [contractId]);
      const contract = contractRows[0];
      
      if (!contract) {
        throw new Error('Contract not found');
      }

      // Generate unique project code
      const year = new Date().getFullYear();
      const projectCode = `PRJ-${year}-${contractId.toString().padStart(4, '0')}`;

      // Check if project already exists for this contract
      const existingProjectQuery = `SELECT id FROM projects WHERE project_code = ?`;
      const [existingRows] = await db.execute(existingProjectQuery, [projectCode]);
      
      if (existingRows.length > 0) {
        console.log(`✅ Project already exists for contract ${contractId}: ${projectCode} (ID: ${existingRows[0].id})`);
        return existingRows[0].id;
      }

      // Insert into projects table
      const projectInsertQuery = `
        INSERT INTO projects (
          project_code,
          project_name,
          client_name,
          location,
          start_date,
          status,
          created_at
        ) VALUES (?, ?, ?, ?, ?, 'planning', NOW())
      `;

      const [result] = await db.execute(projectInsertQuery, [
        projectCode,
        contract.project_name,
        contract.developer_company,
        contract.location,
        contract.contract_date
      ]);

      console.log(`✅ Project created successfully: ${projectCode} (ID: ${result.insertId})`);
      return result.insertId;
      
    } catch (error) {
      // Handle duplicate entry error gracefully
      if (error.code === 'ER_DUP_ENTRY') {
        console.log(`✅ Project already exists (duplicate entry handled): ${error.sqlMessage}`);
        // Try to get the existing project ID
        try {
          const year = new Date().getFullYear();
          const projectCode = `PRJ-${year}-${contractId.toString().padStart(4, '0')}`;
          const existingProjectQuery = `SELECT id FROM projects WHERE project_code = ?`;
          const [existingRows] = await db.execute(existingProjectQuery, [projectCode]);
          if (existingRows.length > 0) {
            return existingRows[0].id;
          }
        } catch (lookupError) {
          console.error("❌ ERROR: Failed to lookup existing project:", lookupError);
        }
        return null; // Return null if we can't find the existing project
      }
      
      console.error("❌ ERROR: Failed to create project from contract:", error);
      throw error;
    }
  },

  // Get all foremen from the database
  getForemen: async () => {
    try {
      console.log("Executing foremen query...");
      
      // First, let's see all roles that contain 'foreman'
      const roleQuery = `SELECT DISTINCT r.name as role_name FROM roles r WHERE r.name LIKE '%foreman%'`;
      const [roleRows] = await db.execute(roleQuery);
      console.log("Roles containing 'foreman':", roleRows);
      
      // Now get all employees with foreman roles (excluding general_foreman)
      const query = `
        SELECT 
          e.employee_id,
          e.full_name,
          e.contact,
          e.profile_picture,
          r.name as role_name,
          d.name as department_name,
          e.employment_status
        FROM employees e
        JOIN roles r ON e.role_id = r.id
        JOIN departments d ON r.department_id = d.id
        WHERE r.name LIKE '%foreman%'
        AND r.name != 'general_foreman'
        AND e.is_deleted = 0
        ORDER BY e.full_name ASC
      `;
      console.log("Main query:", query);
      const [rows] = await db.execute(query);
      console.log("Query result:", rows);
      return rows;
    } catch (error) {
      console.error("Error in getForemen:", error);
      throw error;
    }
  },

  // Create material request
  createMaterialRequest: async (data) => {
    try {
      const { request_no, project_id, requested_by, department_id, source_type, purpose, materials } = data;
      
      // Insert each material as a separate request record
      const insertPromises = materials.map(material => {
        let query, params;
        
        if (source_type === 'owner_supply') {
          // For owner supply, use owner_supply_id instead of material_id
          query = `
            INSERT INTO request_material (
              request_no,
              project_id,
              requested_by,
              department_id,
              owner_supply_id,
              quantity,
              unit,
              purpose,
              source_type,
              status,
              requested_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', NOW())
          `;
          params = [
            request_no,
            project_id,
            requested_by,
            department_id,
            material.material_id, // This is actually supply_id for owner supply
            material.quantity,
            material.unit,
            purpose,
            source_type
          ];
        } else {
          // For company supply, use material_id
          query = `
            INSERT INTO request_material (
              request_no,
              project_id,
              requested_by,
              department_id,
              material_id,
              quantity,
              unit,
              purpose,
              source_type,
              status,
              requested_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', NOW())
          `;
          params = [
            request_no,
            project_id,
            requested_by,
            department_id,
            material.material_id,
            material.quantity,
            material.unit,
            purpose,
            source_type
          ];
        }
        
        return db.execute(query, params);
      });

      await Promise.all(insertPromises);
      
      return request_no; // Return the request number as ID
    } catch (error) {
      console.error("Error in createMaterialRequest:", error);
      throw error;
    }
  },

  // Get manufacturing request materials (all statuses from pending to released)
  getManufacturingRequestMaterials: async () => {
    try {
      const query = `
        SELECT 
          rm.request_no,
          rm.project_id,
          rm.requested_by,
          rm.department_id,
          rm.source_type,
          rm.purpose,
          rm.status,
          rm.requested_at,
          rm.approved_at,
          p.project_name,
          e.full_name as requested_by_name,
          d.name as department_name
        FROM request_material rm
        LEFT JOIN projects p ON rm.project_id = p.id
        LEFT JOIN employees e ON rm.requested_by = e.employee_id
        LEFT JOIN departments d ON rm.department_id = d.id
        WHERE rm.department_id = 3
        ORDER BY rm.requested_at DESC
      `;
      
      const [rows] = await db.execute(query);
      
      // Group materials by request_no
      const requestMap = new Map();
      
      for (const row of rows) {
        const requestNo = row.request_no;
        
        if (!requestMap.has(requestNo)) {
          requestMap.set(requestNo, {
            request_no: requestNo,
            project_id: row.project_id,
            project_name: row.project_name,
            requested_by: row.requested_by,
            requested_by_name: row.requested_by_name,
            department_id: row.department_id,
            department_name: row.department_name,
            source_type: row.source_type,
            purpose: row.purpose,
            status: row.status,
            requested_at: row.requested_at,
            approved_at: row.approved_at,
            materials: []
          });
        }
        
        // Get materials for this request
        const materialQuery = `
          SELECT 
            rm.material_id,
            rm.owner_supply_id,
            rm.quantity,
            rm.unit,
            rm.source_type,
            CASE 
              WHEN rm.source_type = 'owner_supply' THEN os.material_name
              WHEN rm.source_type = 'company_supply' THEN m.name
              ELSE 'Unknown Material'
            END as material_name
          FROM request_material rm
          LEFT JOIN owners_supply os ON rm.owner_supply_id = os.supply_id
          LEFT JOIN materials m ON rm.material_id = m.material_id
          WHERE rm.request_no = ?
        `;
        
        const [materials] = await db.execute(materialQuery, [requestNo]);
        requestMap.get(requestNo).materials = materials;
      }
      
      return Array.from(requestMap.values());
    } catch (error) {
      console.error("Error in getManufacturingRequestMaterials:", error);
      throw error;
    }
  },

  // Mark materials as received
  markMaterialsReceived: async (requestNo) => {
    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();

      console.log('Marking materials as received for request:', requestNo);

      // Update request status to 'received'
      const updateResult = await connection.query(`
        UPDATE request_material 
        SET status = 'received'
        WHERE request_no = ?
      `, [requestNo]);

      console.log('Updated request_material status to received:', updateResult[0].affectedRows, 'rows affected for request_no:', requestNo);

      if (updateResult[0].affectedRows === 0) {
        await connection.rollback();
        return { success: false, error: 'Request not found or already processed' };
      }

      await connection.commit();
      return { success: true, affectedRows: updateResult[0].affectedRows };
    } catch (error) {
      await connection.rollback();
      console.error('Error in markMaterialsReceived:', error);
      throw new Error('Failed to mark materials as received');
    } finally {
      connection.release();
    }
  }
};

module.exports = ManufacturingModel;
