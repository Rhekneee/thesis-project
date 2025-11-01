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
    // Get only proposals with pending status
    const proposalsQuery = `
      SELECT 
        p.proposal_id,
        p.project_name,
        p.location,
        p.blocks,
        p.description,
        p.status,
        p.estimated_cost,
        p.created_at,
        da.company_name as developer_company,
        da.contact_number as developer_contact,
        da.email as developer_email
      FROM proposals p
      LEFT JOIN developer_accounts da ON p.developer_id = da.id
      ORDER BY p.created_at DESC
    `;
    const [proposals] = await db.execute(proposalsQuery);
    
    return proposals;
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
          cr.role_name AS worker_type_name,
          l.manpower_per_unit,
          l.unit_description
        FROM labor l
        JOIN construction_roles cr ON cr.id = l.worker_type_id
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
        cr.role_name AS worker_type_name,
        l.manpower_per_unit,
        l.unit_description
      FROM labor l
      JOIN construction_roles cr ON cr.id = l.worker_type_id
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

  // LABOR: update project_id when contract becomes active
  updateLaborWithProjectId: async (contractId, projectId) => {
    try {
      // Get the proposal_id from the contract
      const contractQuery = `SELECT proposal_id FROM contracts WHERE contract_id = ?`;
      const [contractRows] = await db.execute(contractQuery, [contractId]);
      
      if (contractRows.length === 0) {
        console.error('Contract not found:', contractId);
        return;
      }
      
      const proposalId = contractRows[0].proposal_id;
      
      // Update all labor records for this proposal with the new project_id
      const updateQuery = `
        UPDATE labor 
        SET project_id = ?
        WHERE proposal_id = ?
      `;
      
      const [result] = await db.execute(updateQuery, [projectId, proposalId]);
      
      console.log(`✅ Updated ${result.affectedRows} labor records with project_id ${projectId} for proposal ${proposalId}`);
      
      return result.affectedRows;
    } catch (error) {
      console.error('❌ Error updating labor with project_id:', error);
      throw error;
    }
  },

  // WORKER TYPES: list
  getWorkerTypes: async () => {
    const query = `
      SELECT id as worker_type_id, role_name as name, daily_rate as description
      FROM construction_roles
      ORDER BY role_name ASC
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
          cr.role_name AS worker_type_name,
          l.manpower_per_unit,
          l.unit_description
        FROM labor l
        JOIN construction_roles cr ON cr.id = l.worker_type_id
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
    const projectId = await ManufacturingModel.createProjectFromContract(contractId);
    
    // Update labor records with the new project_id
    if (projectId) {
      await ManufacturingModel.updateLaborWithProjectId(contractId, projectId);
    }
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
          developer_id,
          created_at
        ) VALUES (?, ?, ?, ?, ?, 'planning', ?, NOW())
      `;

      const [result] = await db.execute(projectInsertQuery, [
        projectCode,
        contract.project_name,
        contract.developer_company,
        contract.location,
        contract.contract_date,
        contract.developer_id
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
      const insertPromises = materials.map(async (material) => {
        let query, params;
        
        if (source_type === 'owner_supply') {
          // For owner supply, use owner_supply_id instead of material_id. Price is NULL for owner supply.
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
              price,
              status,
              requested_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', NOW())
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
            source_type,
            null // price
          ];
        } else {
          // For company supply, use material_id and store the price from materials table
          // Fetch price for the material_id
          const [priceRows] = await db.execute(`SELECT price FROM materials WHERE material_id = ?`, [material.material_id]);
          const unitPrice = priceRows && priceRows[0] ? Number(priceRows[0].price) || 0 : 0;
          
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
              price,
              status,
              requested_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', NOW())
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
            source_type,
            unitPrice
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
            rm.price,
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
  },

  // ========== CONSTRUCTION WORKERS METHODS ==========
  
  getAllConstructionWorkers: async () => {
    try {
      const [rows] = await db.query(`
        SELECT 
          cw.id,
          cw.picture,
          cw.firstname,
          cw.middlename,
          cw.lastname,
          cw.contact_number,
          cw.role_id,
          cw.project_id,
          cw.date_hired,
          cw.status,
          cw.created_at,
          cr.role_name,
          p.project_name
        FROM construction_workers cw
        LEFT JOIN construction_roles cr ON cw.role_id = cr.id
        LEFT JOIN projects p ON cw.project_id = p.id
        ORDER BY cw.created_at DESC
      `);
      return rows;
    } catch (error) {
      console.error('❌ Error getting all construction workers:', error);
      throw error;
    }
  },

  getConstructionWorkerById: async (workerId) => {
    try {
      const [rows] = await db.query(`
        SELECT 
          cw.id,
          cw.firstname,
          cw.middlename,
          cw.lastname,
          cw.contact_number,
          cw.role_id,
          cw.project_id,
          cw.date_hired,
          cw.status,
          cw.created_at,
          cr.role_name,
          cr.daily_rate,
          p.project_name
        FROM construction_workers cw
        LEFT JOIN construction_roles cr ON cw.role_id = cr.id
        LEFT JOIN projects p ON cw.project_id = p.id
        WHERE cw.id = ?
      `, [workerId]);
      return rows[0] || null;
    } catch (error) {
      console.error('❌ Error getting construction worker by ID:', error);
      throw error;
    }
  },

  addConstructionWorker: async (workerData) => {
    try {
      const {
        firstname,
        middlename,
        lastname,
        contact_number,
        role_id,
        project_id,
        picture,
        status = 'inactive'
      } = workerData;

      // Set date_hired to today's date automatically
      const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format

      // Start transaction to ensure data consistency
      const connection = await db.getConnection();
      await connection.beginTransaction();

      try {
        // Insert construction worker
        const [result] = await connection.query(`
          INSERT INTO construction_workers (
            firstname, middlename, lastname, contact_number,
            role_id, project_id, picture, date_hired, status
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          firstname, middlename, lastname, contact_number,
          role_id, project_id, picture || null, today, status
        ]);

        const workerId = result.insertId;

        // Decrease manpower_per_unit in labor table
        const [updateResult] = await connection.query(`
          UPDATE labor 
          SET manpower_per_unit = manpower_per_unit - 1
          WHERE project_id = ? AND worker_type_id = ? AND manpower_per_unit > 0
        `, [project_id, role_id]);

        if (updateResult.affectedRows === 0) {
          throw new Error('No available manpower for this role in the selected project');
        }

        await connection.commit();

        return {
          id: workerId,
          ...workerData,
          date_hired: today
        };
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }
    } catch (error) {
      console.error('❌ Error adding construction worker:', error);
      throw error;
    }
  },

  updateConstructionWorker: async (workerId, workerData) => {
    try {
      const {
        firstname,
        middlename,
        lastname,
        contact_number,
        role_id,
        project_id,
        date_hired,
        status
      } = workerData;

      const [result] = await db.query(`
        UPDATE construction_workers 
        SET 
          firstname = ?,
          middlename = ?,
          lastname = ?,
          contact_number = ?,
          role_id = ?,
          project_id = ?,
          date_hired = ?,
          status = ?
        WHERE id = ?
      `, [
        firstname, middlename, lastname, contact_number,
        role_id, project_id, date_hired, status, workerId
      ]);

      return result.affectedRows > 0;
    } catch (error) {
      console.error('❌ Error updating construction worker:', error);
      throw error;
    }
  },

  deleteConstructionWorker: async (workerId) => {
    try {
      // Start transaction to ensure data consistency
      const connection = await db.getConnection();
      await connection.beginTransaction();

      try {
        // Get worker details before deletion
        const [workerRows] = await connection.query(`
          SELECT project_id, role_id FROM construction_workers WHERE id = ?
        `, [workerId]);

        if (workerRows.length === 0) {
          throw new Error('Construction worker not found');
        }

        const { project_id, role_id } = workerRows[0];

        // Delete construction worker
        const [deleteResult] = await connection.query(`
          DELETE FROM construction_workers WHERE id = ?
        `, [workerId]);

        if (deleteResult.affectedRows === 0) {
          throw new Error('Failed to delete construction worker');
        }

        // Increase manpower_per_unit back in labor table
        await connection.query(`
          UPDATE labor 
          SET manpower_per_unit = manpower_per_unit + 1
          WHERE project_id = ? AND worker_type_id = ?
        `, [project_id, role_id]);

        await connection.commit();
        return true;
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }
    } catch (error) {
      console.error('❌ Error deleting construction worker:', error);
      throw error;
    }
  },

  getAllConstructionRoles: async () => {
    try {
      const [rows] = await db.query(`
        SELECT 
          id,
          role_name,
          daily_rate,
          department_id
        FROM construction_roles
        ORDER BY role_name ASC
      `);
      return rows;
    } catch (error) {
      console.error('❌ Error getting all construction roles:', error);
      throw error;
    }
  },

  getAllActiveProjects: async () => {
    try {
      const [rows] = await db.query(`
        SELECT 
          p.id,
          p.project_name,
          p.location,
          p.start_date,
          p.end_date,
          p.status,
          p.created_at,
          p.project_code,
          c.proposal_id
        FROM projects p
        LEFT JOIN contracts c ON CAST(SUBSTRING_INDEX(p.project_code, '-', -1) AS UNSIGNED) = c.contract_id
        WHERE p.status IN ('planning', 'in_progress')
        ORDER BY p.project_name ASC
      `);
      return rows;
    } catch (error) {
      console.error('❌ Error getting all active projects:', error);
      throw error;
    }
  },

  // Get projects specifically for adding construction workers (with labor roles data)
  getProjectsForConstructionWorkers: async () => {
    try {
      const [rows] = await db.query(`
        SELECT 
          p.id,
          p.project_name,
          p.location,
          p.start_date,
          p.end_date,
          p.status,
          p.created_at
        FROM projects p
        WHERE p.status IN ('planning', 'in_progress')
        ORDER BY p.project_name ASC
      `);
      
      // Get labor roles for each project
      const projectsWithRoles = await Promise.all(rows.map(async (project) => {
        const [laborRoles] = await db.query(`
          SELECT DISTINCT
            l.worker_type_id,
            cr.role_name as worker_type_name,
            cr.daily_rate,
            l.manpower_per_unit
          FROM labor l
          JOIN construction_roles cr ON cr.id = l.worker_type_id
          WHERE l.project_id = ? AND l.manpower_per_unit > 0
          ORDER BY cr.role_name ASC
        `, [project.id]);
        
        return {
          ...project,
          roles: laborRoles
        };
      }));
      
      return projectsWithRoles;
    } catch (error) {
      console.error('❌ Error getting projects for construction workers:', error);
      throw error;
    }
  },

  getProjectLaborRoles: async (projectId) => {
    try {
      const [rows] = await db.query(`
        SELECT DISTINCT
          l.worker_type_id,
          cr.role_name as worker_type_name,
          l.manpower_per_unit
        FROM labor l
        JOIN construction_roles cr ON cr.id = l.worker_type_id
        WHERE l.project_id = ? AND l.manpower_per_unit > 0
        ORDER BY cr.role_name ASC
      `, [projectId]);
      return rows;
    } catch (error) {
      console.error('❌ Error getting project labor roles:', error);
      throw error;
    }
  },

  // Get labor roles for projects with planning status
  getLaborRolesForPlanningProjects: async (projectId) => {
    try {
      const [rows] = await db.query(`
        SELECT DISTINCT
          l.worker_type_id,
          cr.role_name as worker_type_name,
          l.manpower_per_unit,
          p.project_name
        FROM labor l
        JOIN construction_roles cr ON cr.id = l.worker_type_id
        JOIN projects p ON l.project_id = p.id
        WHERE l.project_id = ? 
        AND p.status = 'planning' 
        AND l.manpower_per_unit > 0
        ORDER BY cr.role_name ASC
      `, [projectId]);
      return rows;
    } catch (error) {
      console.error('❌ Error getting labor roles for planning projects:', error);
      throw error;
    }
  },

  // ========== ATTENDANCE METHODS ==========

  // Get construction worker by QR code
  getConstructionWorkerByQRCode: async (qrData) => {
    try {
      const [rows] = await db.query(`
        SELECT 
          cw.id,
          cw.picture,
          cw.firstname,
          cw.middlename,
          cw.lastname,
          cw.contact_number,
          cw.role_id,
          cw.project_id,
          cw.date_hired,
          cw.status,
          cw.unique_code,
          cw.qr_code_path,
          cw.created_at,
          cr.role_name,
          p.project_name
        FROM construction_workers cw
        LEFT JOIN construction_roles cr ON cw.role_id = cr.id
        LEFT JOIN projects p ON cw.project_id = p.id
        WHERE cw.unique_code = ? AND cw.status = 'active'
      `, [qrData]);
      return rows[0] || null;
    } catch (error) {
      console.error('❌ Error getting construction worker by QR code:', error);
      throw error;
    }
  },

  // Check if worker already has attendance record for today
  checkTodayAttendance: async (workerId) => {
    try {
      const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
      const [rows] = await db.query(`
        SELECT * FROM attendance_construction 
        WHERE worker_id = ? AND attendance_date = ?
      `, [workerId, today]);
      return rows[0] || null;
    } catch (error) {
      console.error('❌ Error checking today attendance:', error);
      throw error;
    }
  },

  // Record attendance (time in)
  recordTimeIn: async (workerId, projectId) => {
    try {
      const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
      const now = new Date();
      
      // Check if already has attendance record for today
      const existingRecord = await ManufacturingModel.checkTodayAttendance(workerId);
      
      if (existingRecord) {
        throw new Error('Attendance already recorded for today');
      }

      const [result] = await db.query(`
        INSERT INTO attendance_construction (
          worker_id, project_id, attendance_date, time_in, status
        ) VALUES (?, ?, ?, ?, 'present')
      `, [workerId, projectId, today, now]);

      return result.insertId;
    } catch (error) {
      console.error('❌ Error recording time in:', error);
      throw error;
    }
  },

  // Record attendance (time out)
  recordTimeOut: async (workerId) => {
    try {
      const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
      const now = new Date();
      
      const [result] = await db.query(`
        UPDATE attendance_construction 
        SET time_out = ?
        WHERE worker_id = ? AND attendance_date = ? AND time_out IS NULL
      `, [now, workerId, today]);

      return result.affectedRows > 0;
    } catch (error) {
      console.error('❌ Error recording time out:', error);
      throw error;
    }
  },

  // Get attendance records for a worker
  getWorkerAttendanceRecords: async (workerId, limit = 30) => {
    try {
      const [rows] = await db.query(`
        SELECT 
          ar.*,
          cw.firstname,
          cw.middlename,
          cw.lastname,
          p.project_name
        FROM attendance_construction ar
        JOIN construction_workers cw ON ar.worker_id = cw.id
        LEFT JOIN projects p ON ar.project_id = p.id
        WHERE ar.worker_id = ?
        ORDER BY ar.attendance_date DESC
        LIMIT ?
      `, [workerId, limit]);
      return rows;
    } catch (error) {
      console.error('❌ Error getting worker attendance records:', error);
      throw error;
    }
  },

  // Get all attendance records for a project
  getProjectAttendanceRecords: async (projectId, date = null) => {
    try {
      let query = `
        SELECT 
          ar.*,
          cw.firstname,
          cw.middlename,
          cw.lastname,
          cr.role_name,
          p.project_name
        FROM attendance_construction ar
        JOIN construction_workers cw ON ar.worker_id = cw.id
        LEFT JOIN construction_roles cr ON cw.role_id = cr.id
        LEFT JOIN projects p ON ar.project_id = p.id
        WHERE ar.project_id = ?
      `;
      
      const params = [projectId];
      
      if (date) {
        query += ` AND ar.attendance_date = ?`;
        params.push(date);
      }
      
      query += ` ORDER BY ar.attendance_date DESC, ar.time_in ASC`;
      
      const [rows] = await db.query(query, params);
      return rows;
    } catch (error) {
      console.error('❌ Error getting project attendance records:', error);
      throw error;
    }
  },

  // Get all attendance records for today (all projects)
  getTodayAttendanceRecords: async (date) => {
    try {
      const query = `
        SELECT 
          ar.*,
          cw.firstname,
          cw.middlename,
          cw.lastname,
          cr.role_name,
          p.project_name
        FROM attendance_construction ar
        JOIN construction_workers cw ON ar.worker_id = cw.id
        LEFT JOIN construction_roles cr ON cw.role_id = cr.id
        LEFT JOIN projects p ON ar.project_id = p.id
        WHERE ar.attendance_date = ?
        ORDER BY ar.time_in ASC
      `;
      
      const [rows] = await db.query(query, [date]);
      return rows;
    } catch (error) {
      console.error('❌ Error getting today attendance records:', error);
      throw error;
    }
  },

  // Get all divisions from division_master table
  getAllDivisions: async () => {
    try {
      const [rows] = await db.query(`
        SELECT id, division_name, created_at
        FROM division_master
        ORDER BY id ASC
      `);
      return rows;
    } catch (error) {
      console.error('❌ Error getting all divisions:', error);
      throw error;
    }
  },

  // Get completed projects for a developer
  getCompletedProjectsByDeveloper: async (developerId) => {
    try {
      const [rows] = await db.query(`
        SELECT 
          p.id,
          p.project_code,
          p.project_name,
          p.client_name,
          p.location,
          p.start_date,
          p.end_date,
          p.status
        FROM projects p
        WHERE p.status = 'completed' AND p.developer_id = ?
        ORDER BY p.end_date DESC
      `, [developerId]);
      return rows;
    } catch (error) {
      console.error('❌ Error getting completed projects:', error);
      throw error;
    }
  },

  // Get projects for manufacturing progress tracking (planning status or active contracts)
  getProjectsForProgress: async (developerId = null) => {
    try {
      // First get all planning projects
      const [planningRows] = await db.query(`
        SELECT 
          id,
          project_code,
          project_name,
          client_name,
          location,
          start_date,
          end_date,
          status
        FROM projects
        WHERE status = 'planning' ${developerId ? 'AND developer_id = ?' : ''}
        ORDER BY start_date DESC
      `, developerId ? [developerId] : []);
      
      // Then get active contract projects (status = 'Active' in contracts, matching project created from contract)
      const [activeRows] = await db.query(`
        SELECT 
          p.id,
          p.project_code,
          p.project_name,
          p.client_name,
          p.location,
          p.start_date,
          p.end_date,
          p.status
        FROM projects p
        WHERE p.status = 'in_progress' ${developerId ? 'AND p.developer_id = ?' : ''}
        ORDER BY p.start_date DESC
      `, developerId ? [developerId] : []);
      
      // Combine and remove duplicates
      const allProjects = [...planningRows, ...activeRows];
      const uniqueProjects = allProjects.filter((project, index, self) => 
        index === self.findIndex(p => p.id === project.id)
      );
      
      // Format the results to match expected structure
      return uniqueProjects.map(row => ({
        id: row.id,
        name: row.project_name,
        developer: row.client_name || 'N/A',
        foreman: 'TBD',
        location: row.location,
        status: row.status === 'in_progress' ? 'On Going' : (row.status || 'planning'),
        progress: 0,
        image: '/image/project-2.jpg',
        submissionDate: row.start_date ? new Date(row.start_date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
        manufacturingCost: 0,
        divisionProgress: [],
        dailyLogs: [],
        requestedMaterials: []
      }));
    } catch (error) {
      console.error('❌ Error getting projects for progress:', error);
      throw error;
    }
  },

  // Save division progress entry (for manufacturing progress tracking)
  saveDivisionProgressEntry: async (projectId, divisionId, progressValue) => {
    try {
      // Validate division_id is provided
      if (!divisionId) {
        throw new Error('Division ID is required');
      }
      
      const progress = Math.min(100, Math.max(0, Number(progressValue) || 0));
      
      // Insert into division_progress table
      const [result] = await db.execute(`
        INSERT INTO division_progress (
          project_id, division_id, progress_percentage, created_at
        ) VALUES (?, ?, ?, NOW())
      `, [projectId, divisionId, progress]);
      
      console.log(`✅ Division progress saved: ${progress}% for division_id ${divisionId} (ID: ${result.insertId})`);
      
      // Check if overall progress is 100% and update project status
      const overallProgress = await ManufacturingModel.checkAndUpdateProjectStatus(projectId);
      
      return { entryId: result.insertId, overallProgress };
    } catch (error) {
      console.error('❌ Error saving division progress entry:', error);
      throw error;
    }
  },

  // Check and update project status to completed when overall progress reaches 100%
  checkAndUpdateProjectStatus: async (projectId) => {
    try {
      // Get all division progress entries for this project
      const [divisionRows] = await db.query(`
        SELECT 
          dp.division_id,
          dm.division_name,
          dp.progress_percentage
        FROM division_progress dp
        JOIN division_master dm ON dp.division_id = dm.id
        WHERE dp.project_id = ?
        ORDER BY dp.created_at ASC
      `, [projectId]);
      
      if (divisionRows.length === 0) {
        console.log('No division progress entries found for project');
        return;
      }
      
      // Calculate cumulative progress per division (sum capped at 100%)
      const divisionsMap = {};
      divisionRows.forEach(row => {
        const divName = row.division_name;
        const progress = Number(row.progress_percentage || 0);
        
        if (!divisionsMap[divName]) {
          divisionsMap[divName] = 0;
        }
        
        const current = divisionsMap[divName];
        divisionsMap[divName] = Math.min(100, current + progress);
      });
      
      // Calculate overall progress as average of all divisions
      const divisionProgressValues = Object.values(divisionsMap);
      const overallProgress = divisionProgressValues.length > 0
        ? Math.round(divisionProgressValues.reduce((sum, val) => sum + val, 0) / divisionProgressValues.length)
        : 0;
      
      console.log(`📊 Overall progress for project ${projectId}: ${overallProgress}%`);
      
      // If overall progress is 100%, update project status to 'completed'
      if (overallProgress >= 100) {
        console.log(`✅ Project ${projectId} has reached 100% progress. Updating status to 'completed'`);
        
        await db.query(`
          UPDATE projects 
          SET status = 'completed'
          WHERE id = ? AND status != 'completed'
        `, [projectId]);
        
        console.log(`✅ Project ${projectId} status updated to 'completed'`);
      }
      
      return overallProgress;
    } catch (error) {
      console.error('❌ Error checking and updating project status:', error);
      throw error;
    }
  },

  // Save daily log entry (for manufacturing progress tracking)
  saveDailyLogEntry: async (projectId, divisionName, logDate, description, materialsArray, totalMaterialCost) => {
    try {
      // Get division_id from division_master
      const [divisionRows] = await db.execute(`
        SELECT id FROM division_master WHERE division_name = ?
      `, [divisionName]);
      
      if (divisionRows.length === 0) {
        throw new Error(`Division "${divisionName}" not found`);
      }
      
      const divisionId = divisionRows[0].id;
      const materialUsed = JSON.stringify(materialsArray);
      const quantity = materialsArray.map(m => `${m.name}: ${m.quantity}`).join(', ');
      
      // Insert into daily_logs table
      const [result] = await db.execute(`
        INSERT INTO daily_logs (
          project_id, division_id, log_date, description, material_used, quantity, total_material_cost
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [projectId, divisionId, logDate, description, materialUsed, quantity, totalMaterialCost]);
      
      console.log(`✅ Daily log saved: ${description.substring(0, 30)}... (ID: ${result.insertId})`);
      
      return result.insertId;
    } catch (error) {
      console.error('❌ Error saving daily log entry:', error);
      throw error;
    }
  },

  // Get daily logs for a project (for manufacturing progress tracking)
  getDailyLogsByProject: async (projectId) => {
    try {
      const [rows] = await db.query(`
        SELECT 
          dl.id,
          dl.project_id,
          dl.division_id,
          dm.division_name,
          dl.log_date,
          dl.description,
          dl.material_used,
          dl.quantity,
          dl.total_material_cost,
          dl.created_at
        FROM daily_logs dl
        JOIN division_master dm ON dl.division_id = dm.id
        WHERE dl.project_id = ?
        ORDER BY dl.log_date DESC, dl.created_at DESC
      `, [projectId]);
      
      return rows;
    } catch (error) {
      console.error('❌ Error getting daily logs by project:', error);
      throw error;
    }
  },

  // Get materials for project dropdown (from owners_supply and material_releases)
  getProjectMaterialsDropdown: async (projectId) => {
    try {
      const materials = [];
      let proposalId = null; // Declare outside to use in multiple queries
      
      // Step 1: Get proposal_id from contract that created this project
      const [projectRows] = await db.query(`
        SELECT project_code FROM projects WHERE id = ?
      `, [projectId]);
      
      if (projectRows.length === 0) {
        return [];
      }
      
      // Extract contract_id from project_code (format: PRJ-YYYY-####)
      const projectCode = projectRows[0].project_code;
      const contractIdMatch = projectCode.match(/PRJ-\d{4}-(\d+)/);
      
      if (contractIdMatch) {
        const contractId = contractIdMatch[1];
        
        // Get proposal_id from contract
        const [contractRows] = await db.query(`
          SELECT proposal_id FROM contracts WHERE contract_id = ?
        `, [contractId]);
        
        if (contractRows.length > 0) {
          proposalId = contractRows[0].proposal_id;
          
          // Get owner supply materials that are DELIVERED to main warehouse
          // Use quantity_requested to show what has been requested/supplied from the owner
          // IMPORTANT: Only get materials from this specific proposal_id to avoid duplicates from other proposals
          const [ownerSupplyMaterials] = await db.query(`
            SELECT 
              CONCAT('owner_', os.supply_id) as id,
              os.material_name as name,
              os.unit,
              os.quantity_requested as requested_qty,
              COALESCE(os.quantity_remaining, 0) as remaining_qty,
              COALESCE(os.quantity_requested * 0, 0.00) as unit_price,
              'owner_supply' as source_type,
              os.supply_id,
              os.proposal_id
            FROM owners_supply os
            WHERE os.proposal_id = ? 
              AND os.status = 'delivered'
              AND os.quantity_requested IS NOT NULL 
              AND os.quantity_requested > 0
            GROUP BY os.supply_id
          `, [proposalId]);
          
          materials.push(...ownerSupplyMaterials);
          console.log(`📦 Owner supply materials for proposal ${proposalId}:`, ownerSupplyMaterials.length);
        }
      }
      
      // Step 2: Get materials from material_releases that have been received
      // This ensures we only get materials from the current project's proposal
      // Skip material_releases query for owner supply - we already got them from owners_supply table
      // Only get company supply materials from material_releases
      let query = `
        SELECT DISTINCT
          CONCAT('release_', mr.id) as id,
          m.name,
          rm.unit,
          COALESCE(rm.quantity_supplied, rm.quantity) as requested_qty,
          COALESCE(rm.quantity - rm.quantity_supplied, 0) as remaining_qty,
          COALESCE(m.price, 0.00) as unit_price,
          mr.source_type,
          mr.id as release_id,
          NULL as proposal_id
        FROM material_releases mr
        INNER JOIN request_material rm ON mr.request_id = rm.id
        LEFT JOIN materials m ON mr.material_id = m.material_id
        WHERE mr.project_id = ?
          AND mr.status IN ('released','received')
          AND mr.source_type = 'company_supply'
        GROUP BY mr.id
      `;
      
      const [requestedMaterials] = await db.query(query, [projectId]);
      
      // Add requested materials
      materials.push(...requestedMaterials);
      console.log(`📦 Requested materials for project ${projectId}:`, requestedMaterials.length);
      
      console.log(`✅ Total materials for project ${projectId}: ${materials.length}`);
      
      // Log each material with its proposal_id or project_id for debugging
      materials.forEach(m => {
        const proposalInfo = m.proposal_id ? `proposal_id: ${m.proposal_id}` : 'N/A';
        const projectInfo = m.project_id ? `project_id: ${m.project_id}` : 'N/A';
        console.log(`   - ${m.name} (${m.source_type}) - ${proposalInfo}, ${projectInfo}`);
      });
      
      return materials;
    } catch (error) {
      console.error('❌ Error getting project materials dropdown:', error);
      throw error;
    }
  },

  // Get material releases intended for a specific project (company and owner supply)
  getProjectMaterialReleases: async (projectId) => {
    try {
      const sql = `
        SELECT 
          mr.id as release_id,
          mr.request_id,
          mr.project_id,
          mr.status as release_status,
          mr.source_type,
          mr.released_at,
          rm.request_no,
          rm.unit,
          COALESCE(rm.quantity_supplied, rm.quantity) AS quantity,
          rm.quantity_backorder,
          CASE 
            WHEN rm.source_type = 'owner_supply' THEN os.material_name
            WHEN rm.source_type = 'company_supply' THEN m.name
            ELSE 'Unknown Material'
          END as material_name,
          CASE 
            WHEN rm.source_type = 'company_supply' THEN COALESCE(rm.price, m.price)
            ELSE NULL
          END as unit_price
        FROM material_releases mr
        INNER JOIN request_material rm ON mr.request_id = rm.id
        LEFT JOIN owners_supply os ON rm.owner_supply_id = os.supply_id
        LEFT JOIN materials m ON rm.material_id = m.material_id
        WHERE mr.project_id = ?
        ORDER BY mr.released_at DESC, mr.id DESC
      `;
      const [rows] = await db.query(sql, [projectId]);
      return rows.map(r => ({
        release_id: r.release_id,
        request_id: r.request_id,
        project_id: r.project_id,
        status: r.release_status,
        source_type: r.source_type,
        released_at: r.released_at,
        request_no: r.request_no,
        unit: r.unit,
        quantity: Number(r.quantity || 0),
        quantity_backorder: Number(r.quantity_backorder || 0),
        material_name: r.material_name,
        unit_price: r.unit_price !== null ? Number(r.unit_price) : null
      }));
    } catch (error) {
      console.error('❌ Error getting project material releases:', error);
      throw error;
    }
  },

  // Get division progress entries for a project
  getDivisionProgressByProject: async (projectId) => {
    try {
      const [rows] = await db.query(`
        SELECT 
          dp.id,
          dp.project_id,
          dp.division_id,
          dm.division_name,
          dp.progress_percentage,
          dp.status,
          dp.remarks,
          dp.start_date,
          dp.target_date,
          dp.created_at,
          dp.updated_at
        FROM division_progress dp
        JOIN division_master dm ON dp.division_id = dm.id
        WHERE dp.project_id = ?
        ORDER BY dp.created_at DESC
      `, [projectId]);
      
      return rows;
    } catch (error) {
      console.error('❌ Error getting division progress by project:', error);
      throw error;
    }
  }
  ,
  // List stage billings for a project (brief)
  getStageBillingsByProject: async (projectId) => {
    try {
      const [rows] = await db.query(`
        SELECT 
          s.id,
          s.project_id,
          s.division_id,
          dm.division_name,
          s.start_date,
          s.end_date,
          s.total_labor_cost,
          s.total_material_cost,
          s.amount_due,
          s.progress_percent,
          s.billing_number,
          s.billing_date,
          s.billing_status
        FROM stage_billing_summary s
        LEFT JOIN division_master dm ON s.division_id = dm.id
        WHERE s.project_id = ?
        ORDER BY s.billing_date DESC, s.id DESC
      `, [projectId]);
      return rows;
    } catch (error) {
      console.error('❌ Error getting stage billings by project:', error);
      throw error;
    }
  }
  ,
  // Detailed stage billing summary: base billing + materials and labor breakdown
  getStageBillingDetail: async (billingId) => {
    try {
      // Base billing
      const [baseRows] = await db.query(`
        SELECT 
          s.*, dm.division_name
        FROM stage_billing_summary s
        LEFT JOIN division_master dm ON s.division_id = dm.id
        WHERE s.id = ?
      `, [billingId]);
      const base = baseRows[0];
      if (!base) return null;

      // Materials from daily_logs: within [start_date, end_date]
      const [matRows] = await db.query(`
        SELECT 
          dl.id as log_id,
          dl.log_date,
          dl.division_id,
          dm.division_name,
          dl.material_used,
          dl.total_material_cost
        FROM daily_logs dl
        LEFT JOIN division_master dm ON dm.id = dl.division_id
        WHERE dl.project_id = ?
          AND dl.log_date BETWEEN ? AND ?
        ORDER BY dl.log_date ASC, dl.id ASC
      `, [base.project_id, base.start_date, base.end_date]);

      // Parse material_used JSON for a flat array breakdown
      const materials = [];
      let materialsTotal = 0;
      for (const r of matRows) {
        let items = [];
        try { items = JSON.parse(r.material_used || '[]'); } catch(_) { items = []; }
        (items || []).forEach(it => {
          const qty = Number(it.quantity || 0);
          const up = Number(it.unitPrice || it.price || 0);
          const sub = qty * up;
          materials.push({ date: r.log_date, division_name: r.division_name, name: it.name || '', quantity: qty, unit_price: up, subtotal: sub });
          materialsTotal += sub;
        });
      }

      // Labor via existing computation (reuse period overlap)
      const labor = await ManufacturingModel.getLaborCostForRange(base.project_id, base.start_date, base.end_date);

      return { base, materials, materials_total: Math.round(materialsTotal * 100) / 100, labor_total: Number(labor || 0) };
    } catch (error) {
      console.error('❌ Error getting stage billing detail:', error);
      throw error;
    }
  }
  ,
  // Aggregate project tracking detail for developer view
  getProjectTrackingDetail: async (projectId) => {
    try {
      // Basic project info
      const [projRows] = await db.query(`
        SELECT id, project_code, project_name, client_name, location, start_date, end_date, status
        FROM projects WHERE id = ?
      `, [projectId]);
      const project = projRows[0] || null;

      // Division progress entries (newest first)
      const divisions = await ManufacturingModel.getDivisionProgressByProject(projectId);

      // Daily logs
      const dailyLogs = await ManufacturingModel.getDailyLogsByProject(projectId);

      // Materials: requested + releases intended for this project
      const requestedMaterials = await ManufacturingModel.getProjectMaterialsDropdown(projectId);
      const materialReleases = await ManufacturingModel.getProjectMaterialReleases(projectId);

      return {
        project,
        divisions,
        dailyLogs,
        requestedMaterials,
        materialReleases
      };
    } catch (error) {
      console.error('❌ Error in getProjectTrackingDetail:', error);
      throw error;
    }
  }
  ,
  // ==================== PROJECT RATINGS (appended feature) ====================
  // Create or update a rating for a completed project
  upsertProjectRating: async ({ projectId, developerId, finishingQuality, structuralAccuracy, timelinePerformance, clientSatisfaction, materialEfficiency, feedback }) => {
    // Compute total score as average of provided criteria (1-10 scale)
    const toNum = (v) => (v === undefined || v === null || v === '' ? null : Number(v));
    const a = [toNum(finishingQuality), toNum(structuralAccuracy), toNum(timelinePerformance), toNum(clientSatisfaction), toNum(materialEfficiency)];
    const nums = a.filter(v => typeof v === 'number' && !isNaN(v));
    const total = nums.length ? (nums.reduce((s, v) => s + v, 0) / nums.length) : null;

    // Check if rating exists
    const [rows] = await db.query(`SELECT id FROM project_ratings WHERE project_id = ? AND (developer_id <=> ?)` , [projectId, developerId || null]);
    if (rows && rows.length) {
      // Update
      await db.query(`
        UPDATE project_ratings SET 
          finishing_quality = ?,
          structural_accuracy = ?,
          timeline_performance = ?,
          client_satisfaction = ?,
          material_efficiency = ?,
          total_score = ?,
          feedback = ?,
          rated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [
        toNum(finishingQuality),
        toNum(structuralAccuracy),
        toNum(timelinePerformance),
        toNum(clientSatisfaction),
        toNum(materialEfficiency),
        total,
        feedback || null,
        rows[0].id
      ]);
      return rows[0].id;
    }
    // Insert new
    const [result] = await db.query(`
      INSERT INTO project_ratings (
        project_id, developer_id, finishing_quality, structural_accuracy, timeline_performance,
        client_satisfaction, material_efficiency, total_score, feedback
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      projectId,
      developerId || null,
      toNum(finishingQuality),
      toNum(structuralAccuracy),
      toNum(timelinePerformance),
      toNum(clientSatisfaction),
      toNum(materialEfficiency),
      total,
      feedback || null
    ]);
    return result.insertId;
  },

  // Check if a rating already exists for a given project and developer
  hasProjectRating: async ({ projectId, developerId = null }) => {
    const params = [projectId];
    let sql = `SELECT id FROM project_ratings WHERE project_id = ?`;
    if (developerId !== null && developerId !== undefined) {
      sql += ` AND developer_id <=> ?`;
      params.push(developerId);
    }
    const [rows] = await db.query(sql, params);
    return Array.isArray(rows) && rows.length > 0;
  },

  // Get rating for a project (optionally by developer)
  getProjectRating: async ({ projectId, developerId = null }) => {
    const params = [projectId];
    let sql = `SELECT * FROM project_ratings WHERE project_id = ?`;
    if (developerId !== null && developerId !== undefined) {
      sql += ` AND developer_id <=> ?`;
      params.push(developerId);
    } else {
      sql += ` ORDER BY rated_at DESC LIMIT 1`;
    }
    const [rows] = await db.query(sql, params);
    return rows && rows[0] ? rows[0] : null;
  },

  // Ratings summary grouped by developer with per-criterion averages
  getRatingsSummaryByDeveloper: async ({ startDate = null, endDate = null } = {}) => {
    let where = '';
    const params = [];
    if (startDate && endDate) {
      where = 'WHERE pr.rated_at BETWEEN ? AND ?';
      params.push(startDate, endDate);
    }
    const sql = `
      SELECT 
        pr.developer_id,
        da.company_name AS developer_name,
        COUNT(*) AS total_ratings,
        ROUND(AVG(pr.total_score), 2) AS avg_score,
        ROUND(AVG(pr.finishing_quality), 2) AS avg_finishing_quality,
        ROUND(AVG(pr.structural_accuracy), 2) AS avg_structural_accuracy,
        ROUND(AVG(pr.timeline_performance), 2) AS avg_timeline_performance,
        ROUND(AVG(pr.client_satisfaction), 2) AS avg_client_satisfaction,
        ROUND(AVG(pr.material_efficiency), 2) AS avg_material_efficiency
      FROM project_ratings pr
      LEFT JOIN developer_accounts da ON da.id = pr.developer_id
      ${where}
      GROUP BY pr.developer_id, da.company_name
      ORDER BY avg_score DESC
    `;
    const [rows] = await db.query(sql, params);
    return rows;
  },

  // Overall averages across all ratings
  getRatingsOverallAverages: async ({ startDate = null, endDate = null } = {}) => {
    let where = '';
    const params = [];
    if (startDate && endDate) {
      where = 'WHERE pr.rated_at BETWEEN ? AND ?';
      params.push(startDate, endDate);
    }
    const sql = `
      SELECT 
        ROUND(AVG(pr.total_score), 2) AS avg_total,
        ROUND(AVG(pr.finishing_quality), 2) AS avg_finishing_quality,
        ROUND(AVG(pr.structural_accuracy), 2) AS avg_structural_accuracy,
        ROUND(AVG(pr.timeline_performance), 2) AS avg_timeline_performance,
        ROUND(AVG(pr.client_satisfaction), 2) AS avg_client_satisfaction,
        ROUND(AVG(pr.material_efficiency), 2) AS avg_material_efficiency,
        COUNT(*) AS total_entries
      FROM project_ratings pr
      ${where}
    `;
    const [rows] = await db.query(sql, params);
    return rows && rows[0] ? rows[0] : null;
  },
  /**
   * Insert a Stage Billing Summary record.
   *
   * This persists a single stage/period billing summary into stage_billing_summary.
   * Required inputs:
   *  - projectId: Target project id (FK to projects.id)
   *  - startDate, endDate: Date range covered by this billing (inclusive)
   *  - progressPercent: Overall project progress percent at the time of billing
   *  - remarks: Optional notes
   *  - totalMaterialCost: Frontend-computed sum of material costs within the period (daily logs)
   *
   * Backend additionally computes:
   *  - totalLaborCost: Sum of payroll payouts (if available) within the same date range
   *  - totalExpense: Stored column (labor + material)
   *  - billing_number: Unique human-friendly number (SB-YYYY-XXXXXX)
   *  - amount_due: Mirrors totalExpense currently
   */
  createStageBillingSummary: async ({ projectId, divisionId, startDate, endDate, progressPercent, totalMaterialCost, remarks }) => {
    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();

      // Normalize dates to YYYY-MM-DD to satisfy DATE columns
      const normStartDate = (startDate && startDate.includes('T')) ? startDate.split('T')[0] : startDate;
      const normEndDate = (endDate && endDate.includes('T')) ? endDate.split('T')[0] : endDate;

      // Generate a unique billing number of the form SB-YYYY-XXXXXX
      const year = new Date().getFullYear();
      const rand = Math.floor(Math.random() * 1_000_000).toString().padStart(6, '0');
      const billingNo = `SB-${year}-${rand}`;

      // Compute labor cost from payroll/payslip data if available.
      // NOTE: This query assumes a payslips (or payroll) table with columns: project_id, pay_date, total_amount
      // If your schema differs, update this section accordingly.
      let totalLabor = 0;
      try {
        const [laborRows] = await connection.query(`
          SELECT COALESCE(SUM(total_amount), 0) AS labor_cost
          FROM payslips
          WHERE project_id = ?
            AND pay_date BETWEEN ? AND ?
        `, [projectId, startDate, endDate]);
        totalLabor = Number(laborRows && laborRows[0] && laborRows[0].labor_cost || 0);
      } catch (err) {
        // If payroll/payslips table does not exist or columns differ, fall back to 0
        // This ensures the billing can still be stored using material cost only
        totalLabor = 0;
      }

      const totalMaterial = Number(totalMaterialCost || 0);
      const amountDue = totalLabor + totalMaterial;

      // Insert the stage billing summary record
      await connection.query(`
        INSERT INTO stage_billing_summary (
          project_id, division_id, start_date, end_date,
          total_labor_cost, total_material_cost,
          progress_percent,
          billing_number, billing_date, billing_status,
          amount_due, remarks
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_DATE, 'Generated', ?, ?)
      `, [
        projectId,
        divisionId || null,
        normStartDate, normEndDate,
        totalLabor, totalMaterial,
        Number(progressPercent || 0),
        billingNo,
        amountDue,
        remarks || null
      ]);

      await connection.commit();
      return { success: true, billing_number: billingNo, total_labor_cost: totalLabor, total_material_cost: totalMaterial, amount_due: amountDue };
    } catch (error) {
      await connection.rollback();
      console.error('❌ Error creating stage billing summary:', error);
      throw error;
    } finally {
      connection.release();
    }
  }
  ,
  /**
   * Get total labor cost from payslips within a date range for a project.
   * Returns a number (0 if none or table unavailable).
   * 
   * Note: Uses date overlap logic where payslip.start_date/end_date overlaps with the stage date range.
   * Also checks construction_payroll table for construction workers assigned to the project.
   */
  getLaborCostForRange: async (projectId, startDate, endDate) => {
    try {
      // Normalize dates to YYYY-MM-DD format safely
      const toYmd = (d) => {
        if (!d) return null;
        if (typeof d === 'string') return d.includes('T') ? d.split('T')[0] : d;
        try { return new Date(d).toISOString().split('T')[0]; } catch(_) { return String(d); }
      };
      const normStartDate = toYmd(startDate);
      const normEndDate = toYmd(endDate);
      
      console.log(`[DEBUG] getLaborCostForRange: projectId=${projectId}, startDate=${startDate}->${normStartDate}, endDate=${endDate}->${normEndDate}`);
      
      // Get labor cost from construction payslips where date range overlaps
      // Use start_date and end_date to match the pay period range
      const [conRows] = await db.query(`
        SELECT COALESCE(SUM(cp.net_salary), 0) AS labor_cost
        FROM construction_payslip cp
        WHERE cp.project_id = ?
          AND cp.start_date <= ?
          AND cp.end_date >= ?
      `, [projectId, normEndDate, normStartDate]);
      
      const conLaborCost = Number(conRows && conRows[0] && conRows[0].labor_cost || 0);
      console.log(`[DEBUG] Query result: labor_cost=${conLaborCost}`);
      
      return conLaborCost;
    } catch (err) {
      console.error('Error getting labor cost for range:', err);
      // If finance tables are not present or schema differs, return 0 to keep UI functional
      return 0;
    }
  },
  
  /**
   * Store payment record for stage billing
   * 
   * Stores payment information in stage_billing_payment table.
   * For manual payments: stores payment_method, reference, amount, proof file path.
   * For Stripe payments: stores payment_method, reference, amount, stripe payment details.
   */
  storePaymentRecord: async ({ billingId, paymentMethod, paymentReference, amountPaid, remarks, proofFilePath = null }) => {
    try {
      await db.query(`
        INSERT INTO stage_billing_payment (
          stage_billing_id, payment_method, payment_reference, 
          amount_paid, remarks
        ) VALUES (?, ?, ?, ?, ?)
      `, [billingId, paymentMethod, paymentReference, amountPaid, remarks]);
      
      // Update billing status based on amount paid
      const [billingRows] = await db.query(`
        SELECT amount_due FROM stage_billing_summary WHERE id = ?
      `, [billingId]);
      
      if (billingRows && billingRows.length > 0) {
        const amountDue = Number(billingRows[0].amount_due || 0);
        const amountPaidTotal = await ManufacturingModel.getTotalPaidAmount(billingId);
        
        let newStatus = 'Generated';
        if (amountPaidTotal >= amountDue) {
          newStatus = 'Paid';
        } else if (amountPaidTotal > 0) {
          newStatus = 'Partially Paid';
        }
        
        await db.query(`
          UPDATE stage_billing_summary SET billing_status = ? WHERE id = ?
        `, [newStatus, billingId]);
      }
      
      // Attempt to persist proof file path if provided and column exists
      if (proofFilePath) {
        try {
          await db.query(`
            UPDATE stage_billing_payment 
            SET proof_file_path = ? 
            WHERE stage_billing_id = ? 
              AND payment_reference <=> ? 
            ORDER BY id DESC 
            LIMIT 1
          `, [proofFilePath, billingId, paymentReference || null]);
        } catch (e) {
          // Column may not exist; ignore
          console.warn('proof_file_path update skipped:', e.code || e.message);
        }
      }

      return { success: true };
    } catch (error) {
      console.error('Error storing payment record:', error);
      throw error;
    }
  },
  
  /**
   * Get total amount paid for a stage billing
   */
  getTotalPaidAmount: async (billingId) => {
    try {
      const [rows] = await db.query(`
        SELECT COALESCE(SUM(amount_paid), 0) as total_paid
        FROM stage_billing_payment
        WHERE stage_billing_id = ?
      `, [billingId]);
      
      return Number(rows && rows[0] && rows[0].total_paid || 0);
    } catch (error) {
      console.error('Error getting total paid amount:', error);
      return 0;
    }
  },

  /**
   * Get payments by reference number (to check for duplicates)
   */
  getPaymentsByReference: async (paymentReference) => {
    try {
      const [rows] = await db.query(`
        SELECT * FROM stage_billing_payment
        WHERE payment_reference = ?
      `, [paymentReference]);
      
      return rows;
    } catch (error) {
      console.error('Error getting payments by reference:', error);
      return [];
    }
  }
  ,
  /**
   * Persist PayMongo checkout session metadata for auditing and reconciliation.
   * Safe to call even if table doesn't exist (fails silently).
   */
  savePaymongoCheckoutSession: async ({ sessionId, billingId, amount, reference, remarks, url, status }) => {
    try {
      await db.query(`
        INSERT INTO paymongo_sessions (
          session_id, stage_billing_id, amount, reference, remarks, checkout_url, status, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, NOW())
      `, [sessionId, billingId, amount, reference, remarks, url, status || 'created']);
    } catch (error) {
      // Table might not exist in some deployments; log and continue
      console.warn('paymongo_sessions insert skipped:', error.code || error.message);
    }
  }
  ,
  /**
   * Persist raw PayMongo webhook event payload for traceability.
   * Safe to call even if table doesn't exist (fails silently).
   */
  savePaymongoWebhookEvent: async ({ eventId, type, payloadJson }) => {
    try {
      await db.query(`
        INSERT INTO paymongo_webhook_events (
          event_id, event_type, payload_json, received_at
        ) VALUES (?, ?, ?, NOW())
      `, [eventId, type, payloadJson]);
    } catch (error) {
      console.warn('paymongo_webhook_events insert skipped:', error.code || error.message);
    }
  },

  /**
   * Create vtour permission request
   */
  createVtourPermission: async (data) => {
    try {
      const { developer_id, project_id, remarks } = data;
      
      // Check if developer already has a pending permission request
      const checkQuery = `
        SELECT id FROM vtour_permissions 
        WHERE developer_id = ? AND approval_status = 'pending'
        LIMIT 1
      `;
      const [pendingPermissions] = await db.query(checkQuery, [developer_id]);
      
      if (pendingPermissions && pendingPermissions.length > 0) {
        const error = new Error('You already have a pending permission request. Please wait for approval or rejection before submitting a new one.');
        error.code = 'PENDING_EXISTS';
        throw error;
      }
      
      const query = `
        INSERT INTO vtour_permissions (
          developer_id, project_id, remarks, request_date, approval_status
        ) VALUES (?, ?, ?, NOW(), 'pending')
      `;
      
      const [result] = await db.query(query, [developer_id, project_id, remarks || null]);
      return result.insertId;
    } catch (error) {
      console.error('Error creating vtour permission:', error);
      throw error;
    }
  },

  /**
   * Get all vtour permissions for a developer
   */
  getVtourPermissionsByDeveloper: async (developerId) => {
    try {
      const query = `
        SELECT 
          vp.id,
          vp.project_id,
          vp.developer_id,
          vp.request_date,
          vp.approval_status,
          vp.approved_at,
          vp.remarks,
          p.project_name,
          p.location,
          p.project_code
        FROM vtour_permissions vp
        LEFT JOIN projects p ON vp.project_id = p.id
        WHERE vp.developer_id = ?
        ORDER BY vp.request_date DESC
      `;
      
      const [rows] = await db.query(query, [developerId]);
      return rows;
    } catch (error) {
      console.error('Error getting vtour permissions by developer:', error);
      throw error;
    }
  },

  /**
   * Update vtour permission status
   */
  updateVtourPermissionStatus: async (permissionId, status) => {
    try {
      const query = `
        UPDATE vtour_permissions 
        SET approval_status = ?, approved_at = NOW()
        WHERE id = ?
      `;
      
      const [result] = await db.query(query, [status, permissionId]);
      return result.affectedRows > 0;
    } catch (error) {
      console.error('Error updating vtour permission status:', error);
      throw error;
    }
  }
};

module.exports = ManufacturingModel;
