import GalleryScene from './three/GalleryScene'
import SpikeHost from './SpikeHost'

export default function App() {
  if (window.location.hash === '#spike') return <SpikeHost />
  return <GalleryScene />
}
