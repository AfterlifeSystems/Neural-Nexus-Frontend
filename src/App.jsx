import { Outlet } from 'react-router-dom';

export default function App() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-indigo-900 to-green-900 text-white relative overflow-hidden">
      <div className="relative z-10 flex flex-col h-screen">
        <main className="flex-grow overflow-hidden flex items-center justify-center">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
