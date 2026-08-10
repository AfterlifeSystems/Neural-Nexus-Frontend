// services/ThoughtToImageService.jsx

import {
  incrementPendingRequests,
  decrementPendingRequests,
  clearPendingRequests,
} from '../components/toastManager';

class ThoughtToImageService {
  constructor() {
    this.listenerUnsub = null;
  }

  async startPolling({ user_id, avatar_id, pollingFreq = 10000 }) {
    // Enqueue a request in Firestore for server/worker to process
    try {
      // const reqCol = collection(
      //   db,
      //   'avatars',
      //   avatar_id,
      //   'thought_to_image_requests'
      // );
      // await addDoc(reqCol, {
      //   user_id,
      //   status: 'pending',
      //   created_at: serverTimestamp(),
      // });
      // Listen for reconstructed images arriving
      // const reconCol = collection(
      //   db,
      //   'avatars',
      //   avatar_id,
      //   'reconstructed_images'
      // );
      // const q = query(reconCol, orderBy('created_at', 'desc'), limit(10));
      // this.listenerUnsub = onSnapshot(q, (snap) => {
      //   snap.docChanges().forEach((change) => {
      //     if (change.type === 'added') {
      //       const msg = change.doc.data();
      //       if (msg.image_data) {
      //         const imageUrl = `data:image/png;base64,${msg.image_data}`;
      //         // Create a File from base64
      //         const byteCharacters = atob(msg.image_data);
      //         const byteNumbers = new Array(byteCharacters.length);
      //         for (let i = 0; i < byteCharacters.length; i++) {
      //           byteNumbers[i] = byteCharacters.charCodeAt(i);
      //         }
      //         const byteArray = new Uint8Array(byteNumbers);
      //         const blob = new Blob([byteArray], { type: 'image/png' });
      //         const file = new File([blob], 'reconstructed_image.png', {
      //           type: 'image/png',
      //         });
      //         this.onReconstructedImage?.({ file, imageUrl, metadata: msg });
      //         decrementPendingRequests();
      //       }
      //     }
      //   });
      // });
    } catch (err) {
      console.error('[ThoughtToImage] startPolling error:', err);
    }
  }

  stopPolling() {
    // if (this.listenerUnsub) {
    //   this.listenerUnsub();
    //   this.listenerUnsub = null;
    // }
  }

  cleanup() {
    // this.stopPolling();
    clearPendingRequests();
  }
}

const thoughtToImageService = new ThoughtToImageService();
export default thoughtToImageService;
