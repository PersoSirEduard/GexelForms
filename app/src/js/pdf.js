async function constructPDF(data, overwrite = false) {
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
    
    page.drawText(data.equipment + " equipment for/from " + data.campaign, { x: 40, y: height - 30, size: 15});

    // Date & Name
    page.drawText(`Signed on the ${data.date} by ${data.clientName}.`, { x: 40, y: 90, size: 15});

    // Given by
    page.drawText(`Given by ${data.given}.`, { x: 40, y: 60, size: 15});


    // Equipment

    // Check if any computer is exchanged
    var computers = []

    // Check and add checkboxs
    for (var i = 0; i < data.selectedEquipment.length; i++) {
        var selected = data.selectedEquipment[i];
        const field = form.createCheckBox("gexel.equipment" + selected.value.toLowerCase());
        // Two different rows
        if (i < 6) {
            field.addToPage(page, { x: 35, y: 483 - i*19.5, width: 11, height: 11});
        } else {
            field.addToPage(page, { x: 323, y: 483 - (i - 6)*19.5, width: 11, height: 11});
        }
        
        if (selected.checked) { 

            // Check if any computer is exchanged
            if (selected.value == "Laptop" || selected.value == "PC") {
                computers.push(selected.value)
            }

            field.check(); // Set checked state
        }

        field.enableReadOnly(); // Cannot edit the value directly
    }

    // Access card
    if (data.accessName.length > 0) { // Check if access card number exists
        page.drawText(data.accessName, { x: 395, y: 385.1, size: 8});
    }

    // Computers
    if (computers.length > 0) {
        page.drawText(`Computer${computers.length > 1 ? "s" : ""}:\n${computers.includes("Laptop") ? remote.app.store.get("cityCode") + "-LP-" + data.lpName : ""}\n${computers.includes("PC") ? remote.app.store.get("cityCode") + "-" + data.pcName : ""}`, { x: 40, y: height / 2 - 50, size: 12});
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

    // File data cache
    const cache = form.createTextField('gexel.cache');
    cache.setText(JSON.stringify(data));
    cache.addToPage(page, { x: 10, y: 10, width: 10, height: 10, hidden: true})


    // Save PDF
    const pdfBytes = await pdfDoc.save();

    // Save file

    // Avoid overwriting files
    var file = `${remote.app.store.get('networkPath')}${data.signatureType == "here" || data.signatureType == "none" ? "Complete_" : "Pending_"}${computers.includes("Laptop") ? data.lpName + "-": ""}${computers.includes("PC") ? data.pcName + "-": ""}${data.clientName}-${data.campaign}-${data.date}.pdf`;
    if (!overwrite) {
        var iCopy = 1;
        while (fs.existsSync(file)) {
            file = `${remote.app.store.get('networkPath')}${data.signatureType == "here" || data.signatureType == "none" ? "Complete_" : "Pending_"}${computers.includes("Laptop") ? data.lpName + "-": ""}${computers.includes("PC") ? data.pcName + "-": ""}${data.clientName}-${data.campaign}-${data.date}-(${iCopy}).pdf`;
            iCopy++;
        }
    }

    try {
        fs.writeFileSync(file, pdfBytes);
        return file.replace(remote.app.store.get('networkPath'), ""); // Return file name (and not the absolute path)
    } catch (ex) {
        console.log(ex);
        showAlert("Could not save the PDF.");
        localLog("(Saving PDF) " + ex);
        return false;
    }
}

async function loadPDFCache(file) {

    // Load PDF file
    var pdfBytes;
    try {
        pdfBytes = fs.readFileSync(remote.app.store.get('networkPath') + file);
    } catch (err) {
        // Handle error: file not found
        console.log(err);
        showAlert("Error: Could not find the specified file.");
        localLog(`Error: Could not find and modify ${file} (${err})`);
        return;
    }

    const pdfDoc = await PDFDocument.load(pdfBytes).catch(err => {
        // Handle error: Invalid file
        console.log(err);
        showAlert("Error: Invalid file.");
        localLog(`Error: Invalid file ${file} (${err})`);
        return;
    });

    
    try {
        // Get hidden cache from pdf
        const form = pdfDoc.getForm();
        const cacheField = form.getTextField('gexel.cache')
        const cacheData = JSON.parse(cacheField.getText());

        cacheData.orignalFile = file; // Remember original file name
        
        // Display cached data
        document.getElementById('language-input').value = cacheData.language;
        document.getElementById('campaign-input').value = cacheData.campaign;
        document.getElementById('equipment-input').value = cacheData.equipment;
        document.getElementById('date-input').value = cacheData.date;
        document.getElementById('given-input').value = cacheData.given;
        document.getElementById('client-name-input').value = cacheData.clientName;
        document.getElementById('signature-type-input').value = cacheData.signatureType;
        document.getElementById('client-input').value = cacheData.clientEmail;
        document.getElementById('additional-info').value = cacheData.description;
        document.getElementById('pc-number').value = cacheData.pcName;
        document.getElementById('laptop-number').value = cacheData.lpName;
        document.getElementById('card-number').value = cacheData.accessName;
        for (const selected of cacheData.selectedEquipment) {
            document.getElementById(selected.id).checked = selected.checked;
        }
        // Got to add form page
        onClick_OpenTab('add');

        // Load signature
        onChange_SignatureTypeInput();
        signaturePad.fromData(cacheData.signatureCanvas);

        // Enable modification menu
        document.getElementById('submit-btn').style.display = 'none';
        document.getElementById('modify-panel').style.display = 'block';
        document.getElementById('modify-title').innerHTML = `Currently modifying ${file.replace("Complete_", "").replace("Pending_", "").substr(0, 25)}...`

        document.getElementById('modify-btn').onclick = () => {
            OnClick_Submit(cacheData);
        }

    } catch (err) {
        // Handle error
        console.log(err);
        showAlert(`Error: Cannot modify this older file.`);
        localLog(`Error: ${err}`);
        clearFormInputs();
        return;
    }
    

    
}