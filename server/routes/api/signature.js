const { authenticate, addPendingSignature, verifyId, renderHTML, updateSignature, getSignatures, removeSignature } = require("../../helpers/signHelpers");

module.exports = app => {

    // Add new pending signature
    app.post("/api/new_signature", authenticate, (req, res) => {
        const { file, client } = req.body;

        // Verify file
        if (!file || file == undefined) {
            return res.send({
                success: false,
                message: "Error: Enter a valid file name."
            });
        }

        // Verify client
        if (!client || client == undefined) {
            return res.send({
                success: false,
                message: "Error: Enter a valid client name."
            });
        }

        // Add pending signature
        var signature = addPendingSignature(file, client);

        // Return a success message with the signature ID
        return res.send({
            success: true,
            id: signature.id,
            message: "Success."
        });

    });

    // Signature page
    app.get("/sign/:id", (req, res) => {
        const id = req.params.id;

        var user = verifyId(id); // Verify if the id exists
        if (user) {
            return res
            .set("Content-Security-Policy", "default-src *; style-src 'self' https://* 'unsafe-inline'; script-src 'self' https://* 'unsafe-inline' 'unsafe-eval'")
            .send(renderHTML(user.client, id)); // Return custom webpage
        } else {
            return res.send("The signature form does not exist or is no longer active.");
        }

    });

    // Complete a pending signature
    app.post("/api/submit_signature", (req, res) => {
        const { id, signature } = req.body;

        // Verify if the id was provided
        if (!id || id == undefined) {
            return res.send({
                success: false,
                message: "Error: Enter a valid id."
            });
        }

        // Verify if the signature was provided
        if (!signature || signature == undefined) {
            return res.send({
                success: false,
                message: "Error: Enter a valid signature."
            });
        }

        // Verify if the id exists
        var user = verifyId(id);
        if (user) {

            // Save the image to the local storage
            updateSignature(id, signature);

            // Return a success message
            return res.send({
                success: true,
                message: "Success."
            });

        } else {

            // Error: invalid id
            return res.send({
                success: false,
                message: "Error: Enter a valid id."
            });

        }

    });

    // Remove a completed or uncompleted signature
    app.post("/api/remove_signature", authenticate, (req, res) => {
        const { id } = req.body;

        // Remove the signature from local storage
        if (removeSignature(id)) {

            return res.send({
                success: true,
                message: "Success."
            });

        } else {

            return res.send({
                success: false,
                message: "Error: Could not remove the signature."
            });

        }

    });

    // Get completed signatures
    app.post("/api/get_completed", authenticate, (req, res) => {

        // Get at most 3 completed signatures from local storage
        var completed = getSignatures(true).slice(0, 3);

        return res.send({
            success: true,
            message: "Success.",
            signatures: completed
        });

    });

};