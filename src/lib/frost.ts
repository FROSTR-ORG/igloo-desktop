import {writeKeysetFiles, readKeysetFile} from "./fileio"

export const generateKeyset = async () => {
    // Generate psuedorandom num
    // call frost library with secret to generate
    let newKeyset = {};
    // call fileio to write files
    const written = await writeKeysetFiles(newKeyset, "/")
    if (written.success === true) {
        return written.location
    } else return false
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