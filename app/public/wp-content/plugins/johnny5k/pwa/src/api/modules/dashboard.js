import { api, BASE } from '../core/restClient'

export const dashboardApi = {
  snapshot: () => api.get('/dashboard'),
  awards: () => api.get('/dashboard/awards'),
  johnnyReview: (force = false) => api.get(`/dashboard/johnny-review${force ? '?force=1' : ''}`),
  realSuccessStory: (force = false) => api.get(`/dashboard/real-success-story${force ? '?force=1' : ''}`),
  photosList: () => api.get('/dashboard/photos'),
  photoUpload: (form) => api.upload('/dashboard/photo', form),
  deletePhoto: (id) => api.del(`/dashboard/photo/${id}`),
  setPhotoBaseline: (photoId, angle) => api.post('/dashboard/photos/baseline', { photo_id: photoId, angle }),
  comparePhotos: (firstPhotoId, secondPhotoId) => api.post('/dashboard/photos/compare', {
    first_photo_id: firstPhotoId,
    second_photo_id: secondPhotoId,
  }),
  photoBlob: (id) => api.blob(`/dashboard/photo/${id}`),
  photoUrl: (id) => `${BASE}/dashboard/photo/${id}`,
}