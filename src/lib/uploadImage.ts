import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from './firebase';
import { v4 as uuidv4 } from 'uuid';

export async function uploadImage(file: File, folder: string = 'uploads'): Promise<string> {
  if (!file) throw new Error('No file provided');
  
  const fileExtension = file.name.split('.').pop();
  const fileName = `${uuidv4()}.${fileExtension}`;
  const filePath = `${folder}/${fileName}`;
  
  const storageRef = ref(storage, filePath);
  
  await uploadBytes(storageRef, file);
  
  const downloadUrl = await getDownloadURL(storageRef);
  return downloadUrl;
}
