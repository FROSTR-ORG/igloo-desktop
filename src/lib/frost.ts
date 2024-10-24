import {writeKeysetFiles, readKeysetFile} from "./fileio"

export const generateKeyset = async (): Promise<{ success: boolean; location: string | null }> => {
    // Generate pseudorandom num
    // call frost library with secret to generate
    let newKeyset = {
        "share1": "",
        "share2": "",
        "share3": "",
        "full": ""
    };
    // call fileio to write files
    const written = await writeKeysetFiles(newKeyset, "/Users/plebdev/Desktop")
    if (written.success === true) {
        return { success: true, location: written.location };
    } else {
        return { success: false, location: null };
    }
}

export const rotateKeyset = async (filepath: string) => {
    // takes in file path
    // read in data from file
    const data = readKeysetFile(filepath)
    // format data from file
    // call frost lib to rotateKeys
    let rotated;
    if (rotated) {
        // call file io to write files
        const written = await writeKeysetFiles(rotated, "/")
        if (written) {
            return written.location;
        } else return false
    }
}
