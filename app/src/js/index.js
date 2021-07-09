const remote = require('electron').remote;
const fs = require('fs');
const path = require('path');
const SignaturePad = require('signature_pad');
const nodemailer = require("nodemailer");
const { exec } = require("child_process");
const { PDFDocument, rgb } = require('pdf-lib');


const app = remote.app;

// Will contain SignaturePad class
var signaturePad = false;

// Init when page is loaded
window.addEventListener('DOMContentLoaded', () => {
    var window = remote.getCurrentWindow();

    // Set title name
    document.getElementById('topbar-title').innerText = window.title

    setupSettings(); // Load settings on settings page
    listFiles(); // Init for the search page
    onChange_Language(); // Init for the add form page
    setupSignaturePad(); // Initialize signature pad
    checkForSignatures(); // Check with signature API

});

window.addEventListener("resize", resizeSignaturePad); // Resize window event for signature pad

// Search for new signatures using the API
var signatureClock = setInterval(checkForSignatures, 300000); // Auto update each 5 mins


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
    });

    // Check if fetch was successful
    if (signature.ok) {
        var response = await signature.json();

        if (response.success) {
            for (signature of response.signatures) {

                const filePath = remote.app.store.get("networkPath") + signature.file;
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
                });
            }
        }
    }
    listFiles();
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

function listFiles(searchKeys = "") {
    // Clear current items
    document.getElementById('search-list-box').innerHTML = "";
    
    // Read all files from the directory
    const PATH = remote.app.store.get('networkPath');
    const MAX_ITEMS = 100;
    var currentItem = 0;

    fs.readdir(PATH, (err, files) => {
        
        files.forEach(file => {

            // Filter search
            for (key of searchKeys.split(" ")) {
                if (!file.toLowerCase().includes(key.toLowerCase())) {
                    return;
                }
            }

            if (currentItem >= MAX_ITEMS) {
                return;
            }

            currentItem++;

            // Create new list box item element
            var fileElem = document.createElement('div');
            fileElem.className = 'search-list-item';

            var stats = fs.lstatSync(PATH + file);
            var isFolder = stats.isDirectory();
            var date = stats.mtime;

            fileElem.innerHTML = `
                ${isFolder ? "<img src='assets/folder-icon.svg'>" : "<img src='assets/file-icon.svg'>"}
                </img><p>${file.replace("Pending_", "").replace("Complete_", "")}</p>
                <span style="color: #5e6052; font-size: small;"></span>
                <span class="dot ${file.includes("Complete_") ? "complete" : ""}${file.includes("Pending_") ? "pending" : ""}"></span>
                <span class="modified-label">         Modified: ${date}</span>`;

            // Open file when double click event
            fileElem.ondblclick = () => exec(`"${PATH+file}"`);

            // Add urgent items on top
            var listBox = document.getElementById('search-list-box');
            if (file.includes("Pending_")) {
                // Urgent on top
                listBox.insertBefore(fileElem, listBox.childNodes[0]);
            } else {
                // Completed or unknown at the bottom
                listBox.appendChild(fileElem);
            }
            
        });
    });


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

// Get contract depending on language
function getContract(language) {
    if (language == "english") {
        return [
        `
         In order to optimize the management of our equipment, we have developed
         a new procedure to that effect. This means that everyone will receive a 
         set of working equipment to be kept for the duration of your employement 
         at <b>GEXEL TELECOM</b>. This equipment will be loaned to you.
        `,
        `
        You will be responsible for this equipment as the cost of this equipment is a significant investment for the Company. 
        Therefore, will be held responsible for all damaged or lost equipment. However, you will not be held liable for damages due 
        to normal wear and tear and damages covered by the warranty of the equipment. I hereby confirm that I have been informed of 
        the cost of the equipment that will be loaned to me for my usage during my employement at GEXEL and you have validated the status of these. 
        I also accept the following conditions: In case I lose the equipment, I will be held responsible for the replacement costs; In case of any 
        damages of derect to the equipment not covered by the warrenty, I will be held responsible for all replacement costs other than normal wear and tear; 
        In case of the termination of employement, I will be responsible for returning the equipment at the pick up address. Otherwise, the cost of this
        equipment will be deducted from my last paycheck.
        `];
    } else {
        return [
        `
        Chaque employé se verra remettre un emsemble d'outils de travail qu'il conservera durant son emploi chez <b>GEXEL</b>.
        Ces outils vous seront prêtés personnellement, pour votre seule utilisation.
        `,
        `
        L'achat de ces outils représente un investissement important pour la Compagnie. 
        Vous ne serez, bien entendu, pas tenu responsable pour les bris dus à l'usure, 
        les dommages normaux et ceux couverts par la garantie des équipements. Par la présente, 
        j'atteste avoir pris connaissance des coûts des équipements de travail, valider 
        l'état des équipements remis et j'accepte les conidtions suivantes: En case de perte 
        d'équipement, je suis responsable de la totalité des coûts de remplacement; En cas de 
        bris ou de défectuosité, qui ne résultent pas d'une usure normale et qui ne sont pas 
        couverts par la garantie, je suis responsable de la totalité des coûts de remplacement; 
        Dans le cas d'une cessation d'emploi, je suis responsable de remettre l'équipement en 
        main propre à l'adresse où vous avez pris possession des équipements;
        `];
    }
}

async function OnClick_Submit() {

    // Close alert box
    onClick_AlertBoxClose();

    // Disable button
    var submit = document.getElementById('submit-btn');
    submit.disabled = true;
    var loader = document.getElementById('loader-form');
    loader.style.display = "block";

    // Verify if info is valid
    const data = {
        language: document.getElementById('language-input').value,
        campaign: document.getElementById('campaign-input').value,
        equipment: document.getElementById('equipment-input').value,
        selectedEquipment: document.getElementsByName('selected-equipment'),
        date: document.getElementById('date-input').value,
        given: document.getElementById('given-input').value,
        clientName: document.getElementById('client-name-input').value,
        signatureType: document.getElementById('signature-type-input').value,
        clientEmail: document.getElementById('client-input').value,
        signatureCanvas: document.getElementById('signature-canvas'),
        description: document.getElementById('additional-info').value
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

    // Save PDF
    try {
        var constructed = await constructPDF(data);
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
        return;
    }

    // Send email notification
    if (remote.app.store.get("enableNotification")) {

        // Get equipment
        var equipmentValues = []
        for (var equip of data.selectedEquipment) {
            if (equip.checked) {
                equipmentValues.push(equip.value.replace("_", " "));
            }
        }
        // If no equipment, give default value
        if (equipmentValues.length == 0) {
            equipmentValues.push("None");
        }

        // Prepare and send email
        try {
            var emailMsg = await sendEmail(remote.app.store.get("emailDestination"), {
                subject: `${data.equipment} equipment for/from ${data.clientName}`,
                html: `<b>${data.clientName} from ${data.campaign} came today ${data.equipment == "New" ? "to retrieve new equipment from" : ""}
                       ${data.equipment == "Return" ? "to return equipment to" : ""}${data.equipment == "Replacement" ? "to replace equipment with" : ""} 
                       the GEXEL IT team. The exchange was handled by ${data.given}.</b>
                       <p><u>The following equipment was exchanged:</u><p>
                       <p>${equipmentValues.join(', ')}</p>
                       ${data.description != "" ? "<p><u>Additional info:</u></p>" + "<p>" + data.description + "</p>" : ""}`
            })
        } catch (ex) {
            console.log(ex);
            showAlert("The email could not be sent, but the pdf was saved. Try disabling the email setting for now.")
        }
    }

    if (data.signatureType == "send") {

        // Get signature url
        var signature = await fetch(remote.app.store.get("apiUrl") + "/api/new_signature", {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                auth: remote.app.store.get("apiAuth"),
                file: `Pending_${data.clientName}-${data.campaign}-${data.date}.pdf`,
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
                html: `
                    ${contract[0]}
                    ${contract[1]}
                    <a href="${remote.app.store.get("apiUrl")}/sign/${responseSignature.id}/">Click here to sign the contract.</a>
                `
            })
        } catch (ex) {
            showAlert("The email to the client could not be sent. " + ex);
        }
    }

    // Reset form values
    submit.disabled = false;
    loader.style.display = "none";
    document.getElementById('campaign-input').value = ""
    document.getElementById('date-input').value = "";
    document.getElementById('client-name-input').value = "";
    document.getElementById('client-input').value = "";
    document.getElementById('additional-info').value = "";
    for (var selected of document.getElementsByName('selected-equipment')) {
        selected.checked = false;
    }
    signaturePad.clear();

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

    // Disable canvas
    canvas.className = canvas.className.replace(" visible", "");
    emailInput.className = emailInput.className.replace(" visible", "");

    if (inputBox.value == "here") {
        // Enable canvas
        canvas.className += " visible";
        resizeSignaturePad();
    } else if (inputBox.value == "send") {
        emailInput.className += " visible";
    }
}

function setupSignaturePad() {
    var canvas = document.getElementById('signature-canvas');
    signaturePad = new SignaturePad(canvas);
    resizeSignaturePad();
}

function resizeSignaturePad() {
    var canvas = document.getElementById('signature-canvas');
    var ratio =  Math.max(window.devicePixelRatio || 1, 1);
    canvas.width = canvas.offsetWidth * ratio;
    canvas.height = canvas.offsetHeight * ratio;
    canvas.getContext("2d").scale(ratio, ratio);
    signaturePad.clear(); // otherwise isEmpty() might return incorrect value
}

async function getJSON(path) {
    return new Promise((resolve, reject) => {
        fs.readFile(path, 'utf8', (err, data) => {
            if (err) {
              console.error(err);
              showAlert(`Could not read file at ${path}`);
              reject({});
            }

            try {
                var parsed = JSON.parse(data);
                resolve(parsed);
            } catch (ex) {
                showAlert(`Could not parse the JSON file at ${path}`);
                reject({});
            }
        });
    });
}

async function sendEmail(to, msg) {

    return new Promise((resolve, reject) => {


        var transporter = nodemailer.createTransport({
            service: "Outlook365",
            auth: {
              user: remote.app.store.get("email"),
              pass: remote.app.store.get("password")
            }
        });
    
        var mailOptions = {
            from: remote.app.store.get("email"),
            to: to,
            subject: msg.subject,
            text: msg.text,
            html: msg.html,
            attachments: msg.attachments
        };
    
        transporter.sendMail(mailOptions, function(error, info){
            if (error) {
                console.log(error);
                reject(false);
            } else {
                console.log(info)
                resolve(info);
            }
          });
    });
}

function getSignatureImg() {
    const base64 = signaturePad.toDataURL('image/png').replace("data:image/png;base64,", "");
    const buffer = Buffer.from(base64, "base64");
    return buffer;
}

async function constructPDF(data) {
    // Load appropriate etemplate PDF
    const template = fs.readFileSync(remote.app.store.get(data.language == "english" ? "enPdfTemplate" : "frPdfTemplate"));
    const pdfDoc = await PDFDocument.load(template);

    // Get first page
    const pages = pdfDoc.getPages();
    const page = pages[0];

    // Get page size
    const { width, height } = page.getSize();
    
    const form = pdfDoc.getForm();

    // Equipment & Campaign
    const equipment = form.createDropdown('gexel.equipment');

    equipment.addOptions(['New', 'Return', 'Replacement']);
    equipment.select(data.equipment);

    equipment.addToPage(page, {  x: 40, y: height - 35, height: 20, width: 60 });
    
    page.drawText(" equipment for/from " + data.campaign, { x: 105, y: height - 30, size: 15});

    // Date & Name
    page.drawText(`Signed on the ${data.date} by ${data.clientName}.`, { x: 40, y: 90, size: 15});

    // Given by
    page.drawText(`Given by ${data.given}.`, { x: 40, y: 60, size: 15});

    // Equipment
    for (var i = 0; i < data.selectedEquipment.length; i++) {
        var selected = data.selectedEquipment[i];
        const field = form.createCheckBox("gexel.equipment" + selected.value.toLowerCase());
        field.addToPage(page, { x: 140, y: 480 - i*26.8, width: 15, height: 15});
        if (selected.checked) { field.check(); } // Set state
    }

    // Signature
    if (data.signatureType == "here") {
        await signDocument(pdfDoc, getSignatureImg());
    }

    // Description
    if (data.description != "") {
        const descriptionPage = pdfDoc.addPage([width, height]);
        const description = form.createTextField('gexel.description');
        description.enableMultiline();
        description.setText(data.description);
        description.addToPage(descriptionPage, {x: width / 2 - 200, y: height - 250, width: 400, height: 200 });
    }

    const pdfBytes = await pdfDoc.save();

    // Save file
    if (data.signatureType == "here" || data.signatureType == "none") {
        try {
            fs.writeFileSync(`${remote.app.store.get('networkPath')}Complete_${data.clientName}-${data.campaign}-${data.date}.pdf`, pdfBytes);
            return true;
        } catch (ex) {
            console.log(ex);
            showAlert("Could not save the PDF.");
            return false;
        }
        
    } else {
        try {
            fs.writeFileSync(`${remote.app.store.get('networkPath')}Pending_${data.clientName}-${data.campaign}-${data.date}.pdf`, pdfBytes);
            return true;
        } catch (ex) {
            console.log(ex);
            showAlert("Could not save the PDF.");
            return false;
        }
    }
}

async function signDocument(file, img) {
    if (typeof file === 'string') {
        // Sign already created doucment
        const oldPdfDocBytes = fs.readFileSync(file);
        const pdfDoc = await PDFDocument.load(oldPdfDocBytes);
        const page = pdfDoc.getPages()[0];

        // Signature label
        page.drawText("Signature:", { x: 450, y: 70, size: 12});

        // Build rectangle
        page.drawRectangle({
            x: 450,
            y: 10,
            width: 150,
            height: 50,
            borderWidth: 3,
            color: rgb(1, 1, 1),
            borderColor: rgb(0, 0, 0)
        });

        // Add image
        const pngImage = await pdfDoc.embedPng(img);
        page.drawImage(pngImage, {
            x: 450,
            y: 10,
            width: 150,
            height: 50
        });

        // Save document
        const pdfBytes = await pdfDoc.save();
        // console.log("Saving " + file.replace("Pending_", "Complete_"))
        fs.writeFileSync(file.replace("Pending_", "Complete_"), pdfBytes);
        // Delete old document
        fs.unlinkSync(file);

    } else {
        // Sign document being created
        const page = file.getPages()[0];

        // Signature label
        page.drawText("Signature:", { x: 450, y: 70, size: 12});

        // Build rectangle
        page.drawRectangle({
            x: 450,
            y: 10,
            width: 150,
            height: 50,
            borderWidth: 3,
            color: rgb(1, 1, 1),
            borderColor: rgb(0, 0, 0)
        });

        // Add image
        const pngImage = await file.embedPng(img);
        page.drawImage(pngImage, {
            x: 450,
            y: 10,
            width: 150,
            height: 50
        });
    }
}

/*
    Settings page
*/

function setupSettings() {
    document.getElementById('enable-notification-settings').checked = remote.app.store.get("enableNotification");
    document.getElementById('notification-email-settings').value = remote.app.store.get("emailDestination");
    document.getElementById('network-path-settings').value = remote.app.store.get("networkPath");
}

function onClick_EmailNotificationSettings() {
    var checkbox = document.getElementById('enable-notification-settings');
    remote.app.store.set("enableNotification", checkbox.checked);
}

function onKeyUp_NotificationEmailSettings() {
    var input = document.getElementById('notification-email-settings');
    remote.app.store.set("emailDestination", input.value);
}

function onKeyUp_NetworkPathSettings() {
    var input = document.getElementById('network-path-settings');
    remote.app.store.set("networkPath", input.value.replace("/", "\\"));
}