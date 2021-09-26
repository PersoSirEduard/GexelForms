/*
    Signature pad
*/

function setupSignaturePad() {
    var canvas = document.getElementById('signature-canvas');
    signaturePad = new SignaturePad(canvas);
    resizeSignaturePad();
}

function resizeSignaturePad() {
    const padData = signaturePad.toData(); // Save temporary data
    var canvas = document.getElementById('signature-canvas');
    var ratio =  Math.max(window.devicePixelRatio || 1, 1);
    canvas.width = canvas.offsetWidth * ratio;
    canvas.height = canvas.offsetHeight * ratio;
    canvas.getContext("2d").scale(ratio, ratio);
    signaturePad.clear(); // otherwise isEmpty() might return incorrect value
    signaturePad.fromData(padData); // Load back the temporary data
}

function getSignatureImg() {
    const base64 = signaturePad.toDataURL('image/png').replace("data:image/png;base64,", "");
    const buffer = Buffer.from(base64, "base64");
    return buffer;
}


/*
    Sign PDF
*/

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
