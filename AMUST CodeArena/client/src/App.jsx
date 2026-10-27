export default function App() {
  return (
    <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
      <div className="text-center space-y-4">
        <h1 className="text-5xl font-bold tracking-tight">
          AMUST <span className="text-blue-500">CodeArena</span>
        </h1>
        <p className="text-gray-400 text-lg">
          Virtual Online Judge &amp; Academic LMS
        </p>
        <div className="flex gap-3 justify-center pt-4">
          <span className="px-3 py-1 bg-gray-800 rounded-full text-sm text-gray-300">
            React + Vite
          </span>
          <span className="px-3 py-1 bg-gray-800 rounded-full text-sm text-gray-300">
            Tailwind CSS
          </span>
          <span className="px-3 py-1 bg-gray-800 rounded-full text-sm text-gray-300">
            Express API
          </span>
        </div>
      </div>
    </div>
  );
}
