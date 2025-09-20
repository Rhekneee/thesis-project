$content = Get-Content 'views\finance admin\finance_purchase_order.html' -Raw

# Replace fetchPurchaseOrderEstimations function
$newFetchFunction = @'
        async function fetchPurchaseOrderEstimations() {
            try {
                console.log(' FRONTEND DEBUG: Fetching purchase order estimations...');
                const response = await fetch('/finance/purchase-orders/estimations');
                console.log(' FRONTEND DEBUG: Response status:', response.status);
                
                const data = await response.json();
                console.log(' FRONTEND DEBUG: Response data:', data);
                
                if (data.success) {
                    console.log(' FRONTEND DEBUG: Success! Orders received:', data.orders);
                    console.log(' FRONTEND DEBUG: Number of orders:', data.orders.length);
                    
                    estimations = data.orders;
                    console.log(' FRONTEND DEBUG: Estimations array set to:', estimations);
                    
                    renderEstimations();
                } else {
                    console.log(' FRONTEND DEBUG: Request failed:', data.message);
                    showAlert('error', 'Failed to fetch purchase order estimations');
                }
            } catch (error) {
                console.error(' FRONTEND DEBUG: Error fetching estimations:', error);
                showAlert('error', 'Failed to fetch purchase order estimations');
            }
        }
'@

# Replace renderEstimations function
$newRenderFunction = @'
        // Render estimations table
        function renderEstimations() {
            console.log(' FRONTEND DEBUG: renderEstimations called');
            console.log(' FRONTEND DEBUG: estimations array:', estimations);
            console.log(' FRONTEND DEBUG: estimations length:', estimations.length);
            
            const estimationList = document.getElementById('estimationList');
            console.log(' FRONTEND DEBUG: estimationList element:', estimationList);
            
            estimationList.innerHTML = '';
            
            const startIndex = (currentEstimationPage - 1) * estimationItemsPerPage;
            const endIndex = Math.min(startIndex + estimationItemsPerPage, estimations.length);
            const paginatedEstimations = estimations.slice(startIndex, endIndex);
            
            console.log(' FRONTEND DEBUG: paginatedEstimations:', paginatedEstimations);

            paginatedEstimations.forEach((estimation, index) => {
                console.log( FRONTEND DEBUG: Processing estimation  + index + :, estimation);
                
                const row = document.createElement('tr');
                row.innerHTML = 
                    <td> + estimation.po_id + </td>
                    <td> + (estimation.supplier_name || '-') + </td>
                    <td> + (estimation.material_type || '-') + </td>
                    <td> + Number(estimation.quantity).toFixed(2) +   + (estimation.unit || '') + </td>
                    <td> + Number(estimation.estimation_cost).toLocaleString() + </td>
                    <td>-</td>
                    <td>-</td>
                    <td> + Number(estimation.estimation_cost).toLocaleString() + </td>
                    <td>
                        <button class="btn btn-success btn-sm" onclick="approvePurchaseOrderEstimation( + estimation.po_id + )">
                            <i class="fas fa-check"></i> Approve
                        </button>
                    </td>
                ;
                estimationList.appendChild(row);
            });
            
            console.log(' FRONTEND DEBUG: renderEstimations completed');
        }
'@

# Replace the functions
$content = $content -replace 'async function fetchPurchaseOrderEstimations\(\) \{[^}]+\}', $newFetchFunction
$content = $content -replace 'function renderEstimations\(\) \{[^}]+\}', $newRenderFunction

Set-Content 'views\finance admin\finance_purchase_order.html' -Value $content
