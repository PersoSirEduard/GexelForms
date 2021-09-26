async function handleSearch(files, path, searchKeys) {
    var sortType = document.getElementById('sort-box').value

    // Filter files to match the search
    files = files.filter(file => searchFilter(searchKeys, file));

    // Sort according to preference
    switch(sortType) {
        case 'relevance':
            return files.sort((a, b) => sortRelevance(a, b, path));
        case 'newest':
            const resolved = await Promise.all(files.map(async file => [fs.lstatSync(path + file).mtime, file]));
            return resolved.sort((a, b) => sortNewest(a, b));
        case 'alphabet':
            return files.sort((a, b) => sortAlphabet(a, b));
        default:
            return files.sort((a, b) => sortRelevance(a, b, path));
    }

}

// Check to see if file is desired. Returns a boolean value
function searchFilter(searchKeys, file) {
    for (key of searchKeys.split(" ")) {
        if (!file.toLowerCase().includes(key.toLowerCase())) return false;
    }
    return true;
}

// Sort by relevance
// Priority (highest to lowest):
// * Pending files
// * Completed files
// * Folders & old files
function sortRelevance(a, b, path) {

    if (a.includes("Pending_") || b.includes("Pending_")) {

        aInclude = a.includes("Pending_");
        bInclude = b.includes("Pending_");

        // Priority for pending files over all
        if (aInclude && !bInclude) return -1;
        if (!aInclude && bInclude) return 1;

        // If both are pending, then the priority goes to the most recent file
        if (aInclude && bInclude) {
            return fs.lstatSync(path + b).mtime.getTime() - fs.lstatSync(path + a).mtime.getTime();
        }

    } else if (a.includes("Complete_") || b.includes("Complete_")) {

        aInclude = a.includes("Complete_");
        bInclude = b.includes("Complete_");

        // Priority for completed files over folders and old files
        if (aInclude && !bInclude) return -1;
        if (!aInclude && bInclude) return 1;

        // If both are completed, then the priority goes to the most recent file
        if (aInclude && bInclude) {
            return fs.lstatSync(path + b).mtime.getTime() - fs.lstatSync(path + a).mtime.getTime();
        }
    }
    
    return 0; // Unknown

}

// Sort by newest date
// Newer files are prioritized
function sortNewest(a, b) {
    return b[0] - a[0]
}

// Sort by alphabetical order
// Priority (highest to lowest): Aa-Zz
function sortAlphabet(a, b, searchKeys) {
    var nameA = a.replace("Complete_", "").replace("Pending_", "").toUpperCase(); // ignore upper and lowercase
    var nameB = b.replace("Complete_", "").replace("Pending_", "").toUpperCase(); // ignore upper and lowercase
    
    if (nameA < nameB) return -1;
    if (nameA > nameB) return 1;

    // names must be equal
    return 0;
}

function closeAllLists(elmnt) {
    /*close all autocomplete lists in the document,
    except the one passed as an argument:*/
    var x = document.getElementsByClassName("autocomplete-items");
    for (var i = 0; i < x.length; i++) {
        if (elmnt != x[i] && elmnt != inp) {
            x[i].parentNode.removeChild(x[i]);
        }
    }
}

function getDocumentsPreview(files, searchKeys) {
    // Filter files to match the search
    files = files.filter(file => searchFilter(searchKeys, file));
    
    // Only maintain used documents
    files = files.filter((file, pos) => (file.includes("Pending_") || file.includes("Complete_")));

    // Restructure result to maintain name and campaign only
    files = files.map(file => {
        data = file.replace("Pending_", "").replace("Complete_", "").split("-");
        if (data.length >= 3) {
            if (isNumeric(data[0])) {
                // 0 for pc number, 1 for name, 2 for campaign
                return [data[1], data[2], file];
            } else {
                // 0 for name, 1 for campaign
                return [data[0], data[1], file];
            }
        }
    });

    files = files.sort((a, b) => sortAlphabet(a[0], b[0]));

    return files;
}

// Verify if its a valid string number
function isNumeric(str) {
    if (typeof str != "string") return false
    return (!isNaN(str) && !isNaN(parseFloat(str)))
}
  


