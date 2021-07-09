/*
    Local storage to save the signatures in case the API fails or gets disconnected
*/

const fs = require("fs");

const PATH = "database.json"; // Local storage file

var data = {
    auth: "",
    signatures: []
}

// Check if local storage already exits
if (!fs.existsSync(PATH)) {
    
    // If not, create a new file
    save();
} else {

    // If yes, load the contents of that file
    load();
}

// Save 'data' to local storage
function save() {
    fs.writeFileSync(PATH, JSON.stringify(data));
}

// Load from local storage to 'data'
function load() {
    data = JSON.parse(fs.readFileSync(PATH));
}

module.exports = {data, save, load}