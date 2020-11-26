let transactions = [];
let transactionsTemp = [];
let myChart;

fetch("/api/transaction")
    .then(response => {
        return response.json();
    })
    .then(data => {
        // save db data on global variable
        transactions = data;

        populateTotal();
        populateTable();
        populateChart();
    });

function populateTotal() {
    // reduce transaction amounts to a single total value
    let total = transactions.reduce((total, t) => {
        return total + parseInt(t.value);
    }, 0);

    let totalEl = document.querySelector("#total");
    totalEl.textContent = total;
}

function populateTable() {
    let tbody = document.querySelector("#tbody");
    tbody.innerHTML = "";

    transactions.forEach(transaction => {
        // create and populate a table row
        let tr = document.createElement("tr");
        tr.innerHTML = `
      <td>${transaction.name}</td>
      <td>${transaction.value}</td>
    `;

        tbody.appendChild(tr);
    });
}

function populateChart() {
    // copy array and reverse it
    let reversed = transactions.slice().reverse();
    let sum = 0;

    // create date labels for chart
    let labels = reversed.map(t => {
        let date = new Date(t.date);
        return `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`;
    });

    // create incremental values for chart
    let data = reversed.map(t => {
        sum += parseInt(t.value);
        return sum;
    });

    // remove old chart if it exists
    if (myChart) {
        myChart.destroy();
    }

    let ctx = document.getElementById("myChart").getContext("2d");

    myChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels,
            datasets: [{
                label: "Total Over Time",
                fill: true,
                backgroundColor: "#6666ff",
                data
            }]
        }
    });
}

function saveRecord(transaction) {

    //Store transaction on indexedDB
    const request = indexedDB.open("budgetAppOfflineDatabase", 1);
    // Create an object store inside the onupgradeneeded method.
    request.onupgradeneeded = event => {
        const db = event.target.result;
        const budgetStore = db.createObjectStore("budgetAppOfflineDatabase", { keyPath: "name" });
        // Creates a nameIndex that we can query on.
        budgetStore.createIndex("nameIndex", "name");
    }

    request.onsuccess = () => {
        const db = request.result;
        const trans = db.transaction(["budgetAppOfflineDatabase"], "readwrite");
        const budgetStore = trans.objectStore("budgetAppOfflineDatabase");

        // Adds data to our objectStore
        budgetStore.add({
            name: transaction.name,
            value: transaction.value,
            date: transaction.date
        });
        console.log(`record : ${JSON.stringify(transaction)} added while offline`);

        transactionsTemp = budgetStore.getAll();
        transactionsTemp.onsuccess = () => {
            console.log(transactionsTemp.result);
        }
    }
}

function sendTransaction(isAdding) {
    let nameEl = document.querySelector("#t-name");
    let amountEl = document.querySelector("#t-amount");
    let errorEl = document.querySelector(".form .error");

    // validate form
    if (nameEl.value === "" || amountEl.value === "") {
        errorEl.textContent = "Missing Information";
        return;
    } else {
        errorEl.textContent = "";
    }

    // create record
    let transaction = {
        name: nameEl.value,
        value: amountEl.value,
        date: new Date().toISOString()
    };

    // if subtracting funds, convert amount to negative number
    if (!isAdding) {
        transaction.value *= -1;
    }

    // add to beginning of current array of data
    transactions.unshift(transaction);

    // re-run logic to populate ui with new record
    populateChart();
    populateTable();
    populateTotal();

    if (transactionsTemp.length > 0) {
        fetch("/api/transaction/bulk", {
            method: "POST",
            body: JSON.stringify(transactionsTemp),
            headers: {
                Accept: "application/json, text/plain, */*",
                "Content-Type": "application/json"
            }
        }).then(response => {
            nameEl.value = "";
            amountEl.value = "";
            return response.json();
        });

        transactionsTemp = [];

        //Store transaction on indexedDB
        const request = indexedDB.open("budgetAppOfflineDatabase", 1);
        // Create an object store inside the onupgradeneeded method.
        request.onupgradeneeded = event => {
            const db = event.target.result;
            const budgetStore = db.createObjectStore("budgetAppOfflineDatabase", { keyPath: "name" });
            // Creates a nameIndex that we can query on.
            budgetStore.createIndex("nameIndex", "name");
        }

        request.onsuccess = () => {
            const db = request.result;
            const trans = db.transaction(["budgetAppOfflineDatabase"], "readwrite");
            const budgetStore = trans.objectStore("budgetAppOfflineDatabase");
            budgetStore.clear();
            console.log(request.result + " " + transactionsTemp);

        }

    }


    // also send to server
    fetch("/api/transaction", {
            method: "POST",
            body: JSON.stringify(transaction),
            headers: {
                Accept: "application/json, text/plain, */*",
                "Content-Type": "application/json"
            }
        })
        .then(response => {
            return response.json();
        })
        .then(data => {
            if (data.errors) {
                errorEl.textContent = "Missing Information";
            } else {
                // clear form
                nameEl.value = "";
                amountEl.value = "";
            }
        })
        .catch(err => {
            // fetch failed, so save in indexed db
            saveRecord(transaction);

            // clear form
            nameEl.value = "";
            amountEl.value = "";
        });
}

document.querySelector("#add-btn").onclick = function() {
    sendTransaction(true);
};

document.querySelector("#sub-btn").onclick = function() {
    sendTransaction(false);
};