const random = require("random-string-generator");
var db = require("./database");

// Verify if the request is valid
function authenticate(req, res, next) {
    const { auth } = req.body;

    if (auth == db.data.auth) {
		// Valid request
        next();
        return;

    } else {
		// Invalid request
        return res.send({
            success: false,
            message: "Error: Invalid authentification token."
        });

    }

}

// Add a new signature instance
function addPendingSignature(file, client) {

    // Signature initial data
    var data = {
        id: random(10),
        file: file,
        client: client,
        image: "",
        completed: false
    };

	// Add the signatures in the local storage memory
    db.data.signatures.push(data);
    console.log(`Created a new signature with id ${data.id} for ${data.client}.`);

	// Save the local storage
    db.save();

    return data;
}

// Verify if the id of a signature exists
function verifyId(id) {

	// Get all signatures that were not signed yet
    for (var contract of getSignatures(false)) {

        if (contract.id == id) {
            return contract;
        }

    }

	// No available signature was found with a matching id
    return false;
}

// Get all signatures (false if incompleted and true if completed)
function getSignatures(completed=false) {
    var signatures = [];

    for (var contract of db.data.signatures) {

        if (contract.completed == completed) {
            signatures.push(contract);
        }

    }

    return signatures;
}

function findSignature(file) {

	// Find specific contract from file name
	for (var contract of db.data.signatures) {

		// Found the file and return id
        if (contract.file === file) return contract.id;

    }

	// If no contract was found, create a new one and return id
	return addPendingSignature(file, file).id;

}

// Change image to an assigned signature
function updateSignature(id, image) {
    
    for (var contract of db.data.signatures) {
		// Look out for the signature
        if (contract.id == id) {

			// Change the image
            contract.image = image;

			// Change the status
            if (image != "") {
                contract.completed = true;
            } else {
                contract.completed = false;
            }
            break;
        }

    }

    // Save changes to the local database
    db.save();
}

// Remove a signature
function removeSignature(id) {

    for (var contract of db.data.signatures) {

        if (contract.id == id) {
			// Remove the matching signature
            var index = db.data.signatures.indexOf(contract);
            db.data.signatures.splice(index, 1);
            console.log(`Removed a signature with id ${contract.id} for ${contract.client}`);

			// Save changes to the local database
            db.save();
            return true;
        }

    }

	// Signature was not found
    return false;
}

// Web app source and template
function renderHTML(name, id) {
    return `
    <html>
	<head>
        <title>Gexel Forms</title>
		<script src="https://cdn.jsdelivr.net/npm/signature_pad@2.3.2/dist/signature_pad.min.js"></script>
		<script>
		
			var signaturePad = null;
			
			window.addEventListener('DOMContentLoaded', () => {
				var canvas = document.getElementById("sign-pad");
				signaturePad = new SignaturePad(canvas);
				resizeSignaturePad();
			});
			
			window.addEventListener("resize", resizeSignaturePad);
			
			function resizeSignaturePad() {
				var canvas = document.getElementById('sign-pad');
				var ratio =  Math.max(window.devicePixelRatio || 1, 1);
				canvas.width = canvas.offsetWidth * ratio;
				canvas.height = canvas.offsetHeight * ratio;
				canvas.getContext("2d").scale(ratio, ratio);
				signaturePad.clear(); // otherwise isEmpty() might return incorrect value
				
				// Change pen width
				var weight = window.innerWidth / 150;
				signaturePad.minWidth = weight / 3;
				signaturePad.maxWidth = weight;
			}
			
			async function sendSignature() {
				var canvas = document.getElementById("sign-pad");
				const base64 = signaturePad.toDataURL("image/png").replace("data:image/png;base64,", "");
				
				fetch(window.location.origin + "/api/submit_signature", {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						id: '${id}',
					    signature: base64
					})
				}).then((res) => {
					signaturePad.clear();
                    res.json().then((data) => {
                        if (data.success) {
                            document.getElementById('send-btn').disabled = true;
                            alert("Success! You can now close this page.");
                        } else {
                            alert(data.message);
                            console.log(data);
                        }
                    });
				}).catch((ex) => {
					alert("Error! Could not send the signature");
					alert(ex);
					console.log(ex);
				});
			}
		</script>
		<style>
			#sign-pad {
				width: 80vw;
				height: 40vw;
				border: 1px solid black;
			}
			
			body {
				padding: 0;
				display: flex;
				flex-direction: column;
				justify-content: center;
				align-items: center;
			}
			
			.middle-wrapper {
				padding: 0;
				display: flex;
				flex-direction: column;
			}
			
			.btn {
			  margin-top: 10px;
			  background-color: #4CAF50;
			  border: none;
			  color: white;
			  padding: 15px 32px;
			  text-align: center;
			  text-decoration: none;
			  display: inline-block;
			  font-size: 16px;
			  transition-duration: 0.4s;
			  border-radius: 4px;
			}
			
			.btn:hover {
				background-color: #2f6a31;
			}
			
			#clear-btn {
				margin-right: 10px;
				background-color: red;
			}
			
			#clear-btn:hover {
				background-color: #800000;
			}
			
			.row {
				display: flex;
				flex-direction: row;
			}
			
			#title {
				font-size: 20px;
			}
		</style>
	</head>
	<body>
		<p id="title">Please sign here, ${name}:</p>
		<canvas id="sign-pad"></canvas>
		<div class="row">
			<button id="clear-btn" class="btn" onclick="signaturePad.clear()">Clear</button>
			<button id="send-btn" class="btn" onclick="sendSignature()">Send</button>
		</div>
		
	</body>
</html>
    `;
}

module.exports = { authenticate, addPendingSignature, getSignatures, verifyId, renderHTML, updateSignature, removeSignature, findSignature};