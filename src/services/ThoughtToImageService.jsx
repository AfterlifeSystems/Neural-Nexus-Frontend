// services/ThoughtToImageService.jsx
//
// Placeholder service for the thought-to-image feature. The transport that
// delivers reconstructed images is not built yet — the previous implementation
// depended on a document-database listener this application no longer uses —
// so the service only tracks pending-request toasts today.

import {
  incrementPendingRequests,
  clearPendingRequests,
} from '../components/toastManager';

class ThoughtToImageService {
  async startPolling({ user_id, avatar_id, pollingFreq = 10000 }) {
    console.log(
      '[ThoughtToImage] polling requested for user %s avatar %s every %d ms — transport not yet implemented',
      user_id,
      avatar_id,
      pollingFreq
    );
    incrementPendingRequests();
  }

  connectReconstructedImageWebSocket(user_id) {
    console.log(
      '[ThoughtToImage] reconstructed-image stream requested for user %s — transport not yet implemented',
      user_id
    );
  }

  stopPolling() {}

  cleanup() {
    clearPendingRequests();
  }
}

const thoughtToImageService = new ThoughtToImageService();
export default thoughtToImageService;
