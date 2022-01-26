import { Injectable } from '@angular/core';
import { Camera, CameraResultType, CameraSource, Photo } from '@capacitor/camera';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Storage } from '@capacitor/storage';
import { Platform } from '@ionic/angular';
import { UserPhoto } from '../model/UserPhoto';

@Injectable({
  providedIn: 'root'
})
export class PhotoService {
  photos: UserPhoto[] = [];
  private photoStorage = 'photos';
  private platform: Platform;

  constructor(platform: Platform) {
    this.platform = platform;
   }

  async addToGallery() {
    const capturedPhoto = await Camera.getPhoto({
      resultType: CameraResultType.Uri,
      source: CameraSource.Camera,
      quality: 100
    });

    const savedImageFile = await this.savedPhotos(capturedPhoto);
    this.photos.unshift(savedImageFile);

    Storage.set({
      key: this.photoStorage,
      value: JSON.stringify(this.photos)
    });
  }

  async loadSavedPhotos() {
    // Retrieve cached photo array data
    const photoList = await Storage.get({key: this.photoStorage});
    this.photos = JSON.parse(photoList.value) || [];

    // Easiest way to detect when running on the web "when the platform is not hybrid, do this"

    if(!this.platform.is('hybrid')) {
      // DISPLAYING THE PHOTO BY READING INTO BASE64 FORMAT
      for(const photo of this.photos) {
        const readFile = await Filesystem.readFile({
          path: photo.filePath,
          directory: Directory.Data
        });
        // Web platform only: Load the photo as base64 data
        photo.webviewPath = `data:image/jpeg;base64,${readFile.data}`;
      }

    }


  }


  private async savedPhotos(photo: Photo){
    // Convert photo to base64 format, required by Filesystem API to save
    const base64Data = await this.readAsBase64(photo);
    // WRITE THE FILE TO THE DATA DIRECTORY
    const fileName = new Date().getTime() + '.jpeg';
    const savedFile = await Filesystem.writeFile({
      path: fileName,
      data: base64Data,
      directory: Directory.Data
    });
    if(this.platform.is('hybrid')) {
      // Display the new image by rewriting the 'file://' path to HTTP
      return {
        filePath: savedFile.uri,
        webviewPath: Capacitor.convertFileSrc(savedFile.uri)
      };
    } else {
    return {
      filePath: fileName,
      webviewPath: photo.webPath
    };
  }
  }

  private async readAsBase64(photo: Photo) {
    // "hybrid" will detect Cordova or Capacitor
    if(this.platform.is('hybrid')) {
      const file = await Filesystem.readFile({
        path: photo.path
      });
      return file.data;
    } else {
      // FETCH THE PHOTO, READ AS A BLOB, THEN CONVERT TO BASE64 FORMAT
      const response = await fetch(photo.webPath);
      const blob = await response.blob();

      return await this.convertBlobToBase64(blob) as string;

    }
  }

  private convertBlobToBase64 = (blob: Blob) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      resolve(reader.result);
    };
    reader.readAsDataURL(blob);
  });
}
