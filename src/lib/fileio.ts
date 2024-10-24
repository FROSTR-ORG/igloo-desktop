
export const writeKeysetFiles = async (data: Object, location: string) => {
    // take in json obj and location to write the files
    // create new file for share1 (fros2x), share2 (igloo), share3 (backup), and full bakcup file (keyset)?
    // write to location
    let written;
    // if successful return success: true, locaton: location
    if (written) {
        return {success: true, location: location}
    }
    else {
        return {success: false, location: location}
    }
}

export const readKeysetFile = async (location: string) => {
    // read in location
    // decode and return formatted data
    let data;
    return data ? data : null
}