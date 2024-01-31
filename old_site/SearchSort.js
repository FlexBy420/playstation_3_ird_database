    // JavaScript for searching
    function doSearch() {
        var input, filter, table, tr, tdId, tdTitle, i, txtValueId, txtValueTitle;
        input = document.getElementById("txtSrchDB");
        filter = input.value.toUpperCase(); // Convert search term to uppercase
        table = document.getElementById("dbTable");
        tr = table.getElementsByTagName("tr");
        for (i = 1; i < tr.length; i++) {
            tdId = tr[i].getElementsByTagName("td")[1]; // Game ID column
            tdTitle = tr[i].getElementsByTagName("td")[2]; // Title column
            if (tdId && tdTitle) {
                txtValueId = tdId.textContent || tdId.innerText;
                txtValueTitle = tdTitle.textContent || tdTitle.innerText;
                txtValueId = txtValueId.toUpperCase(); // Convert Game ID to uppercase
                txtValueTitle = txtValueTitle.toUpperCase(); // Convert Title to uppercase
                if (txtValueId.indexOf(filter) > -1 || txtValueTitle.indexOf(filter) > -1) {
                    tr[i].style.display = "";
                } else {
                    tr[i].style.display = "none";
                }
            }
        }
    }

// JavaScript for sorting
var table = document.getElementById("dbTable");
var tr = table.getElementsByTagName('tr');
var count = tr.length;

// Default sort by title alphabetically
sortTable(2);
function sortTable(colID) {
    if (count <= 1) return;
    var lastCol = -1, sortOrder = 1;
    if (colID != lastCol) {
        lastCol = colID, sortOrder = 0;
    } else sortOrder ^= 1;

    setTimeout(function () {
        var r, i, x, y, len, b = 1;
        var rows = Array.from(table.rows).slice(1);
        len = rows.length;
        
        rows.sort(function (a, b) {
            var aText = a.cells[colID].textContent || a.cells[colID].innerText;
            var bText = b.cells[colID].textContent || b.cells[colID].innerText;
            if (colID == 2) {
                return sortOrder ? bText.localeCompare(aText) : aText.localeCompare(bText);
            } else if (colID == 1) {
                return sortOrder ? compareID(bText, aText) : compareID(aText, bText);
            } else {
                return sortOrder ? aText.localeCompare(bText) : bText.localeCompare(aText);
            }
        });
        for (r = b; r < len; r++) {
            table.appendChild(rows[r]);
        }
    }, 0);
}

// Function to compare IDs with numeric parts handled separately
function compareID(id1, id2) {
    var parts1 = id1.split(/([0-9]+)/).filter(Boolean);
    var parts2 = id2.split(/([0-9]+)/).filter(Boolean);

    for (var i = 0; i < Math.min(parts1.length, parts2.length); i++) {
        if (i % 2 === 0) {
            var cmp = parts1[i].localeCompare(parts2[i]);
            if (cmp !== 0) {
                return cmp;
            }
        } else {
            var num1 = parseInt(parts1[i]);
            var num2 = parseInt(parts2[i]);
            if (num1 !== num2) {
                return num1 - num2;
            }
        }
    }
    return parts1.length - parts2.length;
}