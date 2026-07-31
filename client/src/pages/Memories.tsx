import MemoryLibrary from '../components/MemoryLibrary'

function Memories() {
  return (
    <div>
      <h1 className="text-2xl sm:text-3xl font-semibold text-text mb-2">
        Memories
      </h1>
      <p className="text-sm text-text-muted mb-6">
        Browse and manage all your saved memories.
      </p>

      <MemoryLibrary />
    </div>
  )
}

export default Memories
