import { Outlet } from 'react-router-dom';

export default function App() {
  return (
    <div className="min-h-screen bg-black text-neutral-200 relative overflow-hidden">
      <div className="relative z-10 flex flex-col h-screen">
        <main className="flex-grow overflow-hidden flex items-center justify-center">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
