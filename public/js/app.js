document.addEventListener("DOMContentLoaded", () => {
    const toggleBtn = document.getElementById("toggleSidebar");
    const sidebar = document.querySelector(".sidebar");
  
    // Restore sidebar state from localStorage
    if (localStorage.getItem("sidebarMinimized") === "true") {
      sidebar.classList.add("minimized");
    }
  
    toggleBtn.addEventListener("click", () => {
      sidebar.classList.toggle("minimized");
      localStorage.setItem("sidebarMinimized", sidebar.classList.contains("minimized"));
    
      setActiveClass();
    });
  
  
    
    /* active state for sidebar links */
      const links = document.querySelectorAll(".sidebar a");
    
      // Function to remove 'active' class from all links
      function removeActiveClass() {
        links.forEach(link => {
          link.classList.remove("active");
        });
      }
    
      // Function to add 'active' class to the clicked link
      function setActiveClass() {
        links.forEach(link => {
          if (window.location.href.indexOf(link.href) > -1) {
            link.classList.add("active");
          }
        });
      }
    
      // Initialize the active state when the page loads
      setActiveClass();
    
      // Add event listener to each link to update the active state when clicked
      links.forEach(link => {
        link.addEventListener("click", () => {
          removeActiveClass();
          link.classList.add("active");
        });
      });
    
    
  
    /* INVENTORY SEARCH BAR */
    const searchInput = document.getElementById("searchInput");
    if (searchInput) {
      searchInput.addEventListener("input", () => {
        const filter = searchInput.value.toLowerCase();
        const rows = document.querySelectorAll(".material-table tbody tr");
  
        rows.forEach(row => {
          const nameCell = row.children[1].textContent.toLowerCase();
          row.style.display = nameCell.includes(filter) ? "" : "none";
        });
      });
    }
  
    /* SUPPLIER SEARCH BAR */
    const supplierSearch = document.getElementById("supplierSearch");
    if (supplierSearch) {
      supplierSearch.addEventListener("input", () => {
        const filter = supplierSearch.value.toLowerCase();
        const rows = document.querySelectorAll(".supplier-table tbody tr");
  
        rows.forEach(row => {
          const supplierName = row.children[0].textContent.toLowerCase();
          const businessType = row.children[1].textContent.toLowerCase();
          const contactName = row.children[2].textContent.toLowerCase();
  
          const match = supplierName.includes(filter) || businessType.includes(filter) || contactName.includes(filter);
          row.style.display = match ? "" : "none";
        });
      });
    }
  
    
       /* add supplier modal */
      const addSupplierBtn = document.getElementById("addSupplierBtn");
    const supplierModal = document.getElementById("addSupplierModal");
    const supplierForm = document.getElementById("addSupplierForm");
    const closeSupplierBtn = supplierModal?.querySelector(".close-btn");
  
    if (addSupplierBtn && supplierModal && supplierForm && closeSupplierBtn) {
      addSupplierBtn.addEventListener("click", () => {
        supplierModal.style.display = "block";
      });
  
      closeSupplierBtn.addEventListener("click", () => {
        supplierModal.style.display = "none";
      });
  
      window.addEventListener("click", (event) => {
        if (event.target === supplierModal) {
          supplierModal.style.display = "none";
        }
      });
  
      
      supplierForm.addEventListener("submit", (e) => {
        e.preventDefault();
  
        const name = document.getElementById("supplierName").value;
        const type = document.getElementById("businessType").value;
        const contact = document.getElementById("contactName").value;
        const number = document.getElementById("contactNumber").value;
        const location = document.getElementById("location").value;
  
        const table = document.querySelector(".supplier-table tbody");
        const newRow = document.createElement("tr");
  
        newRow.innerHTML = `
          <td>${name}</td>
          <td>${type}</td>
          <td>${contact}</td>
          <td><button class="action-btn">View</button></td>
          <td>
            <button class="action-btn">Edit</button>
            <button class="action-btn">Delete</button>
          </td>
        `;
  
        table.appendChild(newRow);
        supplierModal.style.display = "none";
        supplierForm.reset();
      });
    }
  
    /* request material search bar */
    const requestSearch = document.getElementById("requestSearch");
  if (requestSearch) {
    requestSearch.addEventListener("input", () => {
      const filter = requestSearch.value.toLowerCase();
      const rows = document.querySelectorAll(".request-table tbody tr");
  
      rows.forEach(row => {
        const cells = row.querySelectorAll("td");
        const requestID = cells[0].textContent.toLowerCase();
        const site = cells[1].textContent.toLowerCase();
        const requestedBy = cells[4].textContent.toLowerCase();
        const date = cells[5].textContent.toLowerCase();
  
        const match = requestID.includes(filter) ||
                      site.includes(filter) ||
                      requestedBy.includes(filter) ||
                      date.includes(filter);
        row.style.display = match ? "" : "none";
      });
    });
  }
  /* TRANSFER SEARCH BAR*/
  const transferSearch = document.getElementById("transferSearch");
  if (transferSearch) {
    transferSearch.addEventListener("input", () => {
      const filter = transferSearch.value.toLowerCase();
      const rows = document.querySelectorAll(".transfer-table tbody tr");
  
      rows.forEach(row => {
        const cells = row.querySelectorAll("td");
        const transferid = cells[0].textContent.toLowerCase();
        const requestid = cells[1].textContent.toLowerCase();
      
  
        const match = transferid.includes(filter) ||
                      requestid.includes(filter);
                      
  
        row.style.display = match ? "" : "none";
      });
    });
  }
  
  
  
  
  
   
  
  });
  