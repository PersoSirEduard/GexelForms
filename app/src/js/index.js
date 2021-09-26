const { remote, ipcRenderer } = require('electron');
const fs = require('fs');
const path = require('path');
const SignaturePad = require('signature_pad');
const nodemailer = require("nodemailer");
const { exec } = require("child_process");
const { PDFDocument, rgb } = require('pdf-lib');

const app = remote.app;

// Will contain SignaturePad class
var signaturePad = false;

// Avoid opening more than 1 dialog box at a time
var isDialogOpen = false;

// Keep track of the last automatic update of signatures
var lastSignatureCheck = 0;

// Init when page is loaded
window.addEventListener('DOMContentLoaded', () => {

    // Set title name
    var appWindow = remote.getCurrentWindow();
    document.getElementById('topbar-title').innerText = appWindow.title
    
    window.addEventListener("resize", resizeSignaturePad); // Resize window event for signature pad

    setupSettings(); // Load settings on settings page
    listFiles(); // Init for the search page
    onChange_Language(); // Init for the add form page
    setupSignaturePad(); // Initialize signature pad
    
    // Check signatures when window becomes in focus
    // An interval timer would not work because it would constantly spam the API server when the app is kept running in the background
    appWindow.on('focus', () => {
        var timeDiff = (new Date() - lastSignatureCheck) / 1000; // Time difference in seconds
        
        // Check signatures by minimum intervals of 5 minutes
        if (timeDiff >= 300) {
            checkForSignatures(); // Check with signature API
            lastSignatureCheck = new Date();
        }
    });

});

/*
    Signature API
*/

async function checkForSignatures() {

    // Get signatures that were completed
    var signature = await fetch(remote.app.store.get("apiUrl") + "/api/get_completed", {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            auth: remote.app.store.get("apiAuth")
        })
    }).catch((err) => {
        // Handle and log errors
        console.log(err);
        localLog("(Fetching /api/get_completed) " + err);
    })
    
    // Check if fetch was successful
    if (signature.ok) {
        var response = await signature.json();

        if (response.success) {
            for (signature of response.signatures) {

                const filePath = remote.app.store.get("networkPath") + signature.file;
                console.log(filePath)
                // Check to see if file still exists
                if (fs.existsSync(filePath)) {

                    // Sign document
                    var buffer = Buffer.from(signature.image, "base64");
                    await signDocument(filePath, buffer);
                    
                }

                // Remove signature from API local storage
                var removeSignature = await fetch(remote.app.store.get("apiUrl") + "/api/remove_signature", {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        id: signature.id,
                        auth: remote.app.store.get("apiAuth")
                    })
                }).catch((err) => {
                    // Handle and log errors
                    console.log(err);
                    localLog("(Fetching /api/remove_signature) " + err);
                });
            }
        }
    }
    // Reload search
    listFiles(document.getElementById('searchInput').value);
    return;
}

/*
    Window frame
*/

function onClick_Minimize() {
    var window = remote.getCurrentWindow();
    window.minimize();
}

function onClick_Maximize() {
    var window = remote.getCurrentWindow();
    if (window.isMaximized()) {
        window.unmaximize();
    } else {
        window.maximize();
    }
    checkForSignatures();
}

function onClick_Close() {
    var window = remote.getCurrentWindow();
    window.close();
}

function onClick_Menu() {
    var nav = document.getElementById('side-nav');

    if (nav.style.width == '50px'|| nav.style.width == '') {
        nav.style.width = '200px';
        // Open nav bar
        for (items of nav.children) {
            for (node of items.children) {
                if (node.className.includes('nav-icon')) {
                    node.className = node.className.replace(" nav-icon-active", "")
                } else if (node.className.includes('nav-title')) {
                    node.className += ' nav-title-active';
                }
            }
        }
    } else {
        nav.style.width = '50px';
        // Closed nav bar
        for (items of nav.children) {

            for (node of items.children) {
                if (node.className.includes('nav-title')) {
                    node.className = node.className.replace(" nav-title-active", "")
                } else if (node.className.includes('nav-icon')) {
                    node.className += ' nav-icon-active';
                }
            }

        }
    }
}

/*
    Navbar
*/

function onClick_OpenTab(id) {
    hideAllTabs(); // Hide all tabs

    var nav = document.getElementById('side-nav');
    if (nav.style.width == '200px') {
        onClick_Menu(); // Hide side navbar
    }
    
    document.getElementById(id).className += " active"; // Reveal new tab page
}

function hideAllTabs() {
    var tabs = document.getElementsByClassName("tabcontent");
    for (tab of tabs) {
        tab.className = tab.className.replace(" active", "");
    }
}

/*
    Search page
*/

function onKeyUp_SearchBox() {
    var searchInput = document.getElementById('searchInput');
    listFiles(searchInput.value);
}

function onChange_SearchSort() {
    var searchInput = document.getElementById('searchInput');
    listFiles(searchInput.value);
}

function listFiles(searchKeys = "") {
    // Clear current items
    document.getElementById('search-list-box').innerHTML = "";
    
    // Read all files from the directory
    const PATH = remote.app.store.get('networkPath');
    const MAX_ITEMS = 100; // Limit display

    fs.readdir(PATH, async (err, files) => {

        // Error handling (invalid directory or no permission)
        if (err) {
            showAlert("Could not access the directory.");
            console.log(err);
            localLog("(Access to network path) " + err);
            return;
        }

        (await handleSearch(files, PATH, searchKeys))
        .slice(0, MAX_ITEMS) // Only take a maximum of 100 items
        .forEach(file => {

            // Clean & adjust type from newest
            // this just works [date, file] -> only file
            if (typeof(file) == 'object') file = file[1]

            // Create new list box item element
            var fileElem = document.createElement('div');
            fileElem.className = 'search-list-item';

            var stats = fs.lstatSync(PATH + file);
            var isFolder = stats.isDirectory();
            var date = stats.mtime;

            const emailButton = `<span onclick="onClick_OpenEmailMenu('${file}')" class="action-icon" title="Send Email"><img src="assets/email-icon.svg"></img></span>`;
            const modifyButton = `<span onclick="onClick_ModifyDocument('${file}')" class="action-icon" title="Modify"><img src="assets/modify-icon.svg"></img></span>`

            fileElem.innerHTML = `
                ${isFolder ? "<img src='assets/folder-icon.svg'>" : "<img src='assets/file-icon.svg'>"}
                </img><p>${file.replace("Pending_", "").replace("Complete_", "")}</p>
                <span style="color: #5e6052; font-size: small;"></span>
                <span class="dot ${file.includes("Complete_") ? "complete" : ""}${file.includes("Pending_") ? "pending" : ""}"></span>
                ${file.includes("Complete_") || file.includes("Pending_") ? emailButton : ""}
                ${file.includes("Complete_") || file.includes("Pending_") ? modifyButton : ""}
                <span class="modified-label">         Modified: ${date}</span>`;

            // Open file when double click event
            fileElem.ondblclick = () => exec(`"${PATH+file}"`);
            
            // Make copy of file when dragged on desktop
            fileElem.setAttribute("draggable", "true");
            fileElem.ondragstart = (event) => {
                event.preventDefault()
                ipcRenderer.send('ondragstart', PATH + file)
            }

            // Add items to search list
            var listBox = document.getElementById('search-list-box');
            listBox.appendChild(fileElem);
        });

        
    });

}

function onClick_OpenEmailMenu(file) {

    // Hide background
    var loader = document.getElementById('loader-search');
    loader.style.display = "block";

    // Setup title of menu according to file name
    var cleanFile = file.replace("Pending_", "").replace("Complete_", "");
    document.getElementById('email-menu-title').innerHTML = cleanFile.substr(0, 20) + (cleanFile.length > 20 ? "..." : "");

    // Send new signature request email
    document.getElementById('send-sign-req').onclick = async () => {

        // Verify if email if ok
        if (!document.getElementById('send-email-input').value.includes("@")) {
            showAlert("Please enter a valid email.");
            return;
        }

        // Disable buttons
        onClick_AlertBoxClose();
        document.getElementById('send-sign-req').disabled = true;
        document.getElementById('send-copy').disabled = true;

        // Request for signature ID
        var fetchedRawId = await fetch(remote.app.store.get("apiUrl") + "/api/find_signature", {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ file: file, auth: remote.app.store.get("apiAuth") })
        }).catch((err) => {
            // Handle and log errors
            console.log(err);
            localLog("(Fetching /api/find_signature) " + err);
            showAlert(err);
            
            // Enable buttons
            document.getElementById('send-sign-req').disabled = false;
            document.getElementById('send-copy').disabled = false;
            onClick_CloseEmailMenu();
            return;
        })
        
        if (fetchedRawId.ok) {
            // Send new email
            var fetchedId = await fetchedRawId.json();
            var contract = getContract("english");
            var emailMsg = await sendEmail(document.getElementById('send-email-input').value, {
                subject: `Equipment contract requiring a signature`,
                attachments: [{ filename: file, path: remote.app.store.get('networkPath') + file }],
                html: `
                    <h2>1. Rationale</h2>
                    ${contract[0]}
                    <h2>2. Significance</h2>
                    ${contract[1]}
                    <p><a style="font-size: 20px;" href="${remote.app.store.get("apiUrl")}/sign/${fetchedId.id}/">Click here to sign the contract.</a></p>
                    <p style="color: grey;">In case of a problem, please contact IT support.</p>
                    <p style="color: grey;">Do not reply to this email.</p>
                `
            }).catch(ex => {
                // Handle and log errors
                showAlert("The email could not be sent. " + ex);
                console.log(ex);
                localLog(ex);
            });
        } else {
            console.log("Fetching /api/find_signature error");
            localLog("(Fetching /api/find_signature) Error");
            showAlert("Error could not reach the server.");
        }

        // Enable buttons
        document.getElementById('send-sign-req').disabled = false;
        document.getElementById('send-copy').disabled = false;
        onClick_CloseEmailMenu();

    }

    // Send copy of contract
    document.getElementById('send-copy').onclick = async () => {

        // Verify is email is valid
        if (!document.getElementById('send-email-input').value.includes("@")) {
            showAlert("Please enter a valid email.");
            return;
        }

        // Disable buttons
        onClick_AlertBoxClose();
        document.getElementById('send-sign-req').disabled = true;
        document.getElementById('send-copy').disabled = true;

        // Prepare and send email
        try {
            var emailMsg = await sendEmail(document.getElementById('send-email-input').value, {
                subject: `Equipment contract`,
                html: document.getElementById('send-email-textarea').value,
                attachments: [{ filename: file, path: remote.app.store.get('networkPath') + file }]
            })
        } catch (ex) {
            showAlert("The email could not be sent. " + ex);
            console.log(ex);
            localLog(ex);
        }

        // Enable buttons
        document.getElementById('send-sign-req').disabled = false;
        document.getElementById('send-copy').disabled = false;
        onClick_CloseEmailMenu();
        
    }
}

function onClick_CloseEmailMenu() {
    document.getElementById('loader-search').style.display = 'none';
}

async function onClick_ModifyDocument(file) {
    await loadPDFCache(file);
}

/*
    Add page
*/

// Display contract on page depending on language
function onChange_Language() {
    var languageBox = document.getElementById('language-input')

    if (languageBox.value === "english") {
        // English
        var contract = getContract("english")
        document.getElementById('description-rationale-title').innerHTML = "1| Rationale"
        document.getElementById('description-rationale').innerHTML = contract[0]
        document.getElementById('description-significance-title').innerHTML = "2| Significance"
        document.getElementById('description-significance').innerHTML = contract[1]
    } else {
        // Francais
        var contract = getContract("francais")
        document.getElementById('description-rationale-title').innerHTML = "1| Raisonnement"
        document.getElementById('description-rationale').innerHTML = contract[0]
        document.getElementById('description-significance-title').innerHTML = "2| Conséquences"
        document.getElementById('description-significance').innerHTML = contract[1]
    }
}

// Display or refresh the autocomplete list for names
var currentFocus;
async function onInput_profileAutocomplete() {
    if (!remote.app.store.get("enableAutocomplete")) return; // Ignore function if the feature is disabled

    var nameInput = document.getElementById('client-name-input')

    closeAutocompleteList();

    if (!nameInput.value) return false;

    currentFocus = -1; // No focus

    // Create a new item,
    var itemsList = document.createElement("div");
    itemsList.setAttribute("class", "autocomplete-items");
    itemsList.setAttribute("id", "add-autocomplete-list");
    nameInput.parentNode.appendChild(itemsList);

    // Read all files from the directory
    const PATH = remote.app.store.get('networkPath');
    const MAX_ITEMS = 10; // Limit display

        // Get all files
        fs.readdir(PATH, (err, files) => {

            if (err) {
                console.log("Error: Could not read files for autocompletion. ", err);
                localLog("Error: Could not read files for autocompletion. ", err);
                return;
            }
    
            // Format and filter files
            var items = getDocumentsPreview(files, nameInput.value)
    
            for (var i = 0; i < (MAX_ITEMS < items.length ? MAX_ITEMS : items.length); i++) {
                var item = document.createElement("div");
    
                item.innerHTML = `<strong>${items[i][0]} (${items[i][1]})</strong>`;
                item.innerHTML += `<input type='hidden' value='${items[i][0]}'>`;
                item.innerHTML += `<input type='hidden' value='${items[i][1]}'>`;
                item.addEventListener("click", function(e) {
                    nameInput.value = this.getElementsByTagName('input')[0].value;
                    document.getElementById('campaign-input').value = this.getElementsByTagName('input')[1].value
                    closeAutocompleteList();
                });
    
                itemsList.appendChild(item);
            }
        });

}

// Reinitialize autocomplete list for names
function closeAutocompleteList(exception) {
    var x = document.getElementsByClassName("autocomplete-items");
    for (var i = 0; i < x.length; i++) {
      if (exception != x[i]) x[i].parentNode.removeChild(x[i]);
    }
}

async function OnClick_Submit(original = false) {

    // Close alert box
    onClick_AlertBoxClose();

    // Disable button
    var submit = document.getElementById('submit-btn');
    submit.disabled = true;
    var loader = document.getElementById('loader-form');
    loader.style.display = "block";

    // Extract necessary data and verify it
    const data = {
            language: document.getElementById('language-input').value,
            campaign: document.getElementById('campaign-input').value.replace("-", " "),
            equipment: document.getElementById('equipment-input').value,
            selectedEquipment: Array.from(document.getElementsByName('selected-equipment')).map(select => ({ checked: select.checked, value: select.value, id: select.id })),
            date: document.getElementById('date-input').value,
            given: document.getElementById('given-input').value,
            clientName: document.getElementById('client-name-input').value.replace("-", " "),
            signatureType: document.getElementById('signature-type-input').value,
            clientEmail: document.getElementById('client-input').value,
            signatureCanvas: signaturePad.toData(),
            description: document.getElementById('additional-info').value,
            pcName: document.getElementById('pc-number').value,
            lpName: document.getElementById('laptop-number').value,
            accessName: document.getElementById('card-number').value
        }

    // Verify campaign
    if (data.campaign.replace(" ", "") == "") {
        showAlert("Please enter a valid campaign!");
        submit.disabled = false;
        loader.style.display = "none";
        return;
    }

    // Verify date
    if (data.date == "") {
        showAlert("Please enter a valid date!");
        submit.disabled = false;
        loader.style.display = "none";
        return;
    }

    // Verify given
    if (data.given.replace(" ", "") == "") {
        showAlert("Please enter your name!");
        submit.disabled = false;
        loader.style.display = "none";
        return;
    }

    // Verify client name
    if (data.clientName.replace(" ", "") == "") {
        showAlert("Please enter the client's name!");
        submit.disabled = false;
        loader.style.display = "none";
        return;
    }

    // Check if user email is required and if it is a valid email
    if (data.signatureType == "send" && (data.clientEmail.replace(" ", "") == "" || !data.clientEmail.includes("@"))) {
        showAlert("The client's email is required. Please enter a valid email!");
        submit.disabled = false;
        loader.style.display = "none";
        return;
    }

    // Check if local signature is required and if the canvas was signed
    if (data.signatureType == "here" && signaturePad.toData().length == 0) {
        showAlert("A signature is required!");
        submit.disabled = false;
        loader.style.display = "none";
        return;
    }

    // Check for computer names if necessary
    var laptopChecked = document.getElementById('checkbox-laptop').checked
    if (laptopChecked && data.lpName.length < 5) {
        showAlert("The laptop's name must be specified.")
        submit.disabled = false;
        loader.style.display = "none";
        return;
    }
    var pcChecked = document.getElementById('checkbox-pc').checked
    if (pcChecked && data.pcName.length < 5) {
        showAlert("The pc's name must be specified.")
        submit.disabled = false;
        loader.style.display = "none";
        return;
    }

    // Check for access card if necessary
    var cardChecked = document.getElementById('checkbox-accesscard').checked
    if (cardChecked && data.accessName.length < 4) {
        showAlert("The access card's code must be specified.")
        submit.disabled = false;
        loader.style.display = "none";
        return;
    }


    // Save PDF
    var constructed = "";
    try {
        constructed = await constructPDF(data, original.orignalFile != undefined ? true : false);
        if (!constructed) {
            showAlert("Could not open or save the PDF.");
            submit.disabled = false;
            loader.style.display = "none";
            return;
        }
    } catch (ex) {
        console.log(ex);
        showAlert("Could not open or save the PDF.");
        submit.disabled = false;
        loader.style.display = "none";
        localLog("(Failure to create PDF) " + ex);
        return;
    }

    // Erase the old modified file if necessary
    if (original.orignalFile != undefined && original.orignalFile != constructed && fs.existsSync(remote.app.store.get('networkPath') + original.orignalFile)) {
        try {
            fs.unlinkSync(remote.app.store.get('networkPath') + original.orignalFile);
        } catch (ex) {
            console.log(ex);
            localLog("(Could not remove the old file) " + ex);
        }
    }

    // Send email notification
    if (remote.app.store.get("enableNotification")) {

        // Get equipment
        var equipmentValues = []
        for (var equip of data.selectedEquipment) {
            if (equip.checked) {

                    //equip.value = equip.value.replace("_", " ");

                    // Added equipement modification
                    if (original && !original.selectedEquipment.some(e => e.checked && e.value === equip.value)) {
                        console.log("new " + equip.value)
                        switch(equip.value) {
                            case "PC":
                                equipmentValues.push(`<span title="Added" style="background: green; mso-highlight: green; color: white;">(+) ${equip.value} (${remote.app.store.get("cityCode")}-${data.pcName})</span>`);
                                break;
                            case "Laptop":
                                equipmentValues.push(`<span style="background: green; mso-highlight: green; color: white;">(+) ${equip.value} (${remote.app.store.get("cityCode")}-LP-${data.lpName})</span>`);
                                break;
                            case "Access Card":
                                equipmentValues.push(`<span style="background: green; mso-highlight: green; color: white;">(+) ${equip.value} (${data.accessName})</span>`);
                                break;
                            default:
                                equipmentValues.push(`<span style="background: green; mso-highlight: green; color: white;">(+) ${equip.value.replace("_", " ")}</span>`);
                                break;
                        }
                    } else {

                        // Specification (ID and #) modification
                        switch(equip.value) {
                            case "Laptop":
                                if (original && data.lpName !== original.lpName) {
                                    equipmentValues.push(`<span style="background: yellow; mso-highlight: yellow;">(!) ${equip.value} (${remote.app.store.get("cityCode")}-LP-${data.lpName})</span>`);
                                } else {
                                    equipmentValues.push(`${equip.value} (${remote.app.store.get("cityCode")}-LP-${data.lpName})`); // No mod
                                }
                                break;
                            case "PC":
                                if (original && data.pcName !== original.pcName) {
                                    equipmentValues.push(`<span style="background: yellow; mso-highlight: yellow;">(!) ${equip.value} (${remote.app.store.get("cityCode")}-${data.pcName})</span>`);
                                } else {
                                    equipmentValues.push(`${equip.value} (${remote.app.store.get("cityCode")}-${data.pcName})`); // No mod
                                }
                                break;
                            case "Access Card":
                                if (original && data.accessName !== original.accessName) {
                                    equipmentValues.push(`<span style="background: yellow; mso-highlight: yellow;">(!) ${equip.value} (${data.accessName})</span>`);
                                } else {
                                    equipmentValues.push(`${equip.value} (${data.accessName})`); // No mod
                                }
                                break;
                            default:
                                equipmentValues.push(`${equip.value.replace("_", " ")}`); // No mod
                        }
                        
                    }
                
            }
        }

        //Check for removal modifications
        if (original) {
            for (var equip of original.selectedEquipment) {
                if (equip.checked) {
                    if (!data.selectedEquipment.some(e => e.checked && e.value === equip.value)) equipmentValues.push(`<span style="color: white; background: red; mso-highlight: red;">(-) ${equip.value.replace("_", " ")}</span>`);
                }
            }
        }

        // If no equipment, give default value
        if (equipmentValues.length == 0) equipmentValues.push("None");

        // Prepare and send email
        try {
            // Format additional info message
            var descriptionLines = data.description.split("\n");
            descriptionLines.forEach(function(part, index) {
                descriptionLines[index] = "<p>" + descriptionLines[index] + "</p>";
            });

            var emailMsg = await sendEmail(remote.app.store.get("emailDestination"), {
                subject: `${original.orignalFile != undefined ? "(UPDATED) " : ""}${data.equipment} equipment for/from ${data.clientName}`,
                html: `<b>${data.clientName} from ${data.campaign} came today ${data.equipment == "New" ? "to retrieve new equipment from" : ""}
                       ${data.equipment == "Return" ? "to return equipment to" : ""}${data.equipment == "Replacement" ? "to replace equipment with" : ""} 
                       the GEXEL IT team. The exchange was handled by ${data.given}.${original.orignalFile != undefined ? " Note: The original form document was modified (" + original.orignalFile + ")" : ""}</b>
                       <p><u>The following equipment was exchanged:</u><p>
                       <p>${equipmentValues.join(', ')}</p>
                       ${data.description != "" ? "<p><u>Additional info:</u></p>" + descriptionLines.join("") : ""}`
            })
        } catch (ex) {
            console.log(ex);
            showAlert("The email could not be sent, but the pdf was saved. Try disabling the email setting for now.");
            submit.disabled = false;
            loader.style.display = "none";
            localLog("(Mailing) " + ex);
        }
    }

    if (data.signatureType == "send") {

        // Get signature url
        var signature = await fetch(remote.app.store.get("apiUrl") + "/api/new_signature", {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                auth: remote.app.store.get("apiAuth"),
                file: constructed, // Name of the generated file from above
                client: data.clientName
            })
        });

        // Check if url is valid
        if (!signature.ok) {
            submit.disabled = false;
            loader.style.display = "none";
            showAlert("The PDF could be saved. but no signature URL could be created.")
            return;
        }
        var responseSignature = await signature.json();
        if (!responseSignature.success) {
            submit.disabled = false;
            loader.style.display = "none";
            showAlert("The PDF could be saved. but no signature URL could be created. " + responseSignature.message)
            return;
        }

        // Send email
        var contract = getContract(data.language);
        try {
            var emailMsg = await sendEmail(data.clientEmail, {
                subject: `${data.equipment} equipment for/from ${data.clientName}`,
                attachments: [{ filename: constructed, path: remote.app.store.get('networkPath') + constructed }],
                html: `
                    <h2>1. ${data.language == "english" ? "Rationale" : "Raisonnement"}</h2>
                    ${contract[0]}
                    <h2>2. ${data.language == "english" ? "Significance" : "Conséquences"}</h2>
                    ${contract[1]}
                    <p><a style="font-size: 20px;" href="${remote.app.store.get("apiUrl")}/sign/${responseSignature.id}/">Click here to sign the contract.</a></p>
                    <p style="color: grey;">In case of a problem, please contact IT support.</p>
                    <p style="color: grey;">Do not reply to this email.</p>
                `
            })
        } catch (ex) {
            showAlert("The email to the client could not be sent. " + ex);
            submit.disabled = false;
            loader.style.display = "none";
            console.log(ex);
            localLog(ex);
        }
    }

    // Reset form values
    submit.disabled = false;
    loader.style.display = "none";
    clearFormInputs();
    document.getElementById('submit-btn').style.display = 'block';
    document.getElementById('modify-panel').style.display = 'none';

    // Show success page
    onClick_OpenTab('add-success');
    // Reload signatures
    checkForSignatures();
}

// Close error box
function onClick_AlertBoxClose() {
    document.getElementById('alert-box').style.height = '0px';
    document.getElementById('alert-box-msg').style.display = 'none';
    document.getElementById('alert-box-close').style.display = 'none';
}

// Display error box
function showAlert(msg) {
    document.getElementById('alert-box').style.height = '60px';
    document.getElementById('alert-box-msg').innerHTML = msg;
    document.getElementById('alert-box-msg').style.display = 'block';
    document.getElementById('alert-box-close').style.display = 'block';
}

function onChange_SignatureTypeInput() {
    var inputBox = document.getElementById('signature-type-input');
    var canvas = document.getElementById('signature-canvas');
    var emailInput = document.getElementById('client-email');
    var canvasBtn = document.getElementById('clear-canvas-btn');

    // Disable canvas
    canvas.className = canvas.className.replace(" visible", "");
    emailInput.className = emailInput.className.replace(" visible", "");
    canvasBtn.style.display = "none";

    if (inputBox.value == "here") {
        // Enable canvas
        canvas.className += " visible";
        canvasBtn.style.display = "block";
        resizeSignaturePad();
    } else if (inputBox.value == "send") {
        emailInput.className += " visible";
    }
}

// Make all inputs on the form page empty
function clearFormInputs() {
    document.getElementById('campaign-input').value = ""
    document.getElementById('date-input').value = "";
    document.getElementById('client-name-input').value = "";
    document.getElementById('client-input').value = "";
    document.getElementById('additional-info').value = "";
    document.getElementById('card-number').value = "";
    document.getElementById('pc-number').value = "";
    document.getElementById('laptop-number').value = "";
    for (var selected of document.getElementsByName('selected-equipment')) {
        selected.checked = false;
    }
    signaturePad.clear();
}

function onClick_ExitModifyMenu() {
    document.getElementById('submit-btn').style.display = 'block';
    document.getElementById('modify-panel').style.display = 'none';
    clearFormInputs();
}

/*
    Settings page
*/

function setupSettings() {
    document.getElementById('enable-notification-settings').checked = remote.app.store.get("enableNotification");
    document.getElementById('enable-autocomplete-settings').checked = remote.app.store.get("enableAutocomplete");
    document.getElementById('notification-email-settings').value = remote.app.store.get("emailDestination");
    document.getElementById('network-path-settings').value = remote.app.store.get("networkPath");

}

function onClick_EmailNotificationSettings() {
    var checkbox = document.getElementById('enable-notification-settings');
    remote.app.store.set("enableNotification", checkbox.checked);
}

function onClick_SearchAutocompleteSettings() {
    var checkbox = document.getElementById('enable-autocomplete-settings');
    remote.app.store.set("enableAutocomplete", checkbox.checked);
}

function onKeyUp_NotificationEmailSettings() {
    var input = document.getElementById('notification-email-settings');
    remote.app.store.set("emailDestination", input.value);
}

async function onClick_NetworkPathSettings() {
    if (isDialogOpen) return; // Check to see if window is already open
    var input = document.getElementById('network-path-settings');
    isDialogOpen = true;

    var selected = await remote.dialog.showOpenDialog({
        properties: ['openDirectory']
    });
    isDialogOpen = false;

    // Check if a folder was selected
    if (selected.filePaths.length > 0) {
        var folderPath = selected.filePaths[0] + "\\";

        // Save new setting
        remote.app.store.set("networkPath", folderPath);
        input.value = folderPath;

        // Reload files
        listFiles(document.getElementById('searchInput').value);
    }

}