const db = require("../../../db");

const ManufacturingModel = {
  // Store project without manufacturing_cost on insert
  storeProject: async (data) => {
    const query = `
      INSERT INTO projects (
        project_name,
        location,
        submission_date,
        deadline,
        status,
        project_image,
        developer_id,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
    `;

    const [result] = await db.execute(query, [
      data.project_name,
      data.location,
      data.submission_date,
      data.deadline,
      data.status || 'pending',
      data.project_image,
      data.developer_id,
    ]);

    return result.insertId;
  },

  getAllProjects: async () => {
    const query = `
      SELECT 
        p.*,
        da.company_name as developer_company,
        da.contact_number as developer_contact,
        da.email as developer_email
      FROM projects p
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
      FROM projects p
      LEFT JOIN developer_accounts da ON p.developer_id = da.id
      WHERE p.project_id = ?
    `;
    const [rows] = await db.execute(query, [projectId]);
    return rows[0] || null;
  },

  updateProject: async (projectId, data) => {
    const query = `
      UPDATE projects 
      SET 
        project_name = ?,
        location = ?,
        deadline = ?,
        status = ?,
        project_image = ?,
        manufacturing_cost = ?,
        updated_at = NOW()
      WHERE project_id = ?
    `;
    await db.execute(query, [
      data.project_name,
      data.location,
      data.deadline,
      data.status,
      data.project_image,
      data.manufacturing_cost || null,
      projectId,
    ]);
  },

  updateProjectStatus: async (projectId, status) => {
    const query = `
      UPDATE projects 
      SET 
        status = ?,
        updated_at = NOW()
      WHERE project_id = ?
    `;
    await db.execute(query, [status, projectId]);
  },

  updateManufacturingCost: async (projectId, cost) => {
    const query = `
      UPDATE projects 
      SET 
        manufacturing_cost = ?,
        updated_at = NOW()
      WHERE project_id = ?
    `;
    await db.execute(query, [cost, projectId]);
  },

  getProjectsByDeveloper: async (developerId) => {
    try {
      console.log("🔍 DEBUG: Model - Getting projects for developer ID:", developerId);
      
      const query = `
        SELECT 
          p.*,
          da.company_name as developer_company
        FROM projects p
        LEFT JOIN developer_accounts da ON p.developer_id = da.id
        WHERE p.developer_id = ?
        ORDER BY p.created_at DESC
      `;
      
      console.log("🔍 DEBUG: Model - Executing query with developer ID:", developerId);
      const [rows] = await db.execute(query, [developerId]);
      console.log("🔍 DEBUG: Model - Query executed successfully, found", rows.length, "projects");
      
      return rows;
    } catch (error) {
      console.error("❌ ERROR: Model - Error in getProjectsByDeveloper:", error);
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
      FROM projects p
      LEFT JOIN developer_accounts da ON p.developer_id = da.id
      WHERE p.status = ?
      ORDER BY p.created_at DESC
    `;
    const [rows] = await db.execute(query, [status]);
    return rows;
  }
};

module.exports = ManufacturingModel;
