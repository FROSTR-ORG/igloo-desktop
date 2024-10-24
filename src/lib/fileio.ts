import * as fs from 'fs/promises';
import * as path from 'path';

export const writeKeysetFiles = async (data: {
  share1: string;
  share2: string;
  share3: string;
  full: string;
}, location: string): Promise<{ success: boolean; location: string }> => {
  try {
    // Write individual share files
    await fs.writeFile(path.join(location, 'share1_fros2x.json'), JSON.stringify({ share1: data.share1 }));
    await fs.writeFile(path.join(location, 'share2_igloo.json'), JSON.stringify({ share2: data.share2 }));
    await fs.writeFile(path.join(location, 'share3_backup.json'), JSON.stringify({ share3: data.share3 }));

    // Write full backup file
    await fs.writeFile(path.join(location, 'keyset_full_backup.json'), JSON.stringify(data));

    return { success: true, location };
  } catch (error) {
    console.error('Error writing keyset files:', error);
    return { success: false, location };
  }
};

export const readKeysetFile = async (location: string) => {
    // read in location
    // decode and return formatted data
    let data;
    return data ? data : null
}
