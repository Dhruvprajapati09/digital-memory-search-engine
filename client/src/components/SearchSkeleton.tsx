import Card from './ui/Card'

interface SearchSkeletonProps {
  count?: number
}

function SearchSkeleton({ count = 3 }: SearchSkeletonProps) {
  return (
    <div className="space-y-4" aria-hidden="true">
      {Array.from({ length: count }).map((_, index) => (
        <Card key={index} className="animate-pulse">
          <div className="h-5 bg-gray-200 rounded w-1/3 mb-3" />
          <div className="h-3 bg-gray-100 rounded w-1/4 mb-4" />
          <div className="space-y-2">
            <div className="h-3 bg-gray-100 rounded w-full" />
            <div className="h-3 bg-gray-100 rounded w-5/6" />
            <div className="h-3 bg-gray-100 rounded w-2/3" />
          </div>
        </Card>
      ))}
    </div>
  )
}

export default SearchSkeleton
