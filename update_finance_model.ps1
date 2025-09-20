$content = Get-Content 'backend\departments\finance\model\finance.model.js' -Raw
$newFunction = @'
    static async getPurchaseOrdersWithEstimations() {
        const SQL_COMMAND = 
            SELECT 
                p.purchase_id,
                p.pr_id,
                p.supplier_id,
                sa.supplier_name,
                p.material_id,
                m.name AS material_name,
                p.variant,
                CAST(p.quantity AS DECIMAL(10,2)) AS quantity,
                p.unit,
                CAST(p.unit_price AS DECIMAL(10,2)) AS unit_price,
                COALESCE(p.delivery_cost, 0) AS delivery_cost,
                COALESCE(p.discount, 0) AS discount_percent,
                DATE_FORMAT(p.created_date, '%Y-%m-%d %H:%i:%s') AS created_date,
                pr.justification,
                pr.requested_by,
                d.name as department_name
            FROM purchases p
            LEFT JOIN supplier_account sa ON sa.supplier_id = p.supplier_id
            LEFT JOIN materials m ON m.material_id = p.material_id
            LEFT JOIN purchase_requests pr ON pr.pr_id = p.pr_id
            LEFT JOIN departments d ON pr.department = d.id
            WHERE p.status = 'pending' AND (COALESCE(p.delivery_cost,0) > 0 OR COALESCE(p.discount,0) > 0)
            ORDER BY p.created_date DESC
        ;
        
        try {
            console.log('Executing SQL query for purchases with estimations...');
            const [orders] = await db.query(SQL_COMMAND);
            console.log('Number of purchases found:', orders.length);
            
            return orders.map(r => {
                const subtotal = Number(r.quantity) * Number(r.unit_price);
                const discountAmount = subtotal * (Number(r.discount_percent) / 100);
                const final_total = subtotal - discountAmount + Number(r.delivery_cost);
                return {
                    ...r,
                    po_id: r.purchase_id,
                    material_type: r.material_name,
                    estimation_cost: final_total,
                    subtotal: Number(subtotal.toFixed(2)),
                    discount_amount: Number(discountAmount.toFixed(2)),
                    final_total: Number(final_total.toFixed(2))
                };
            });
        } catch (error) {
            console.error('Error in getPurchaseOrdersWithEstimations:', error);
            throw new Error('Failed to fetch purchases with estimations');
        }
    }
'@

$pattern = 'static async getPurchaseOrdersWithEstimations\(\) \{[^}]+\}'
$content = $content -replace $pattern, $newFunction
Set-Content 'backend\departments\finance\model\finance.model.js' -Value $content
