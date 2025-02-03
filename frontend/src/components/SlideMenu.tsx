import { useState, useEffect, useRef } from "react";
import { Card } from "@radix-ui/themes";
import * as ContextMenu from "@radix-ui/react-context-menu";
import { IoIosAddCircleOutline } from "react-icons/io";

const SlideMenu = () => {
  const [isVisible, setIsVisible] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (menuRef.current) {
        const menuRect = menuRef.current.getBoundingClientRect();
        const isInsideMenu =
          e.clientX >= menuRect.left &&
          e.clientX <= menuRect.right &&
          e.clientY >= menuRect.top &&
          e.clientY <= menuRect.bottom;

        setIsVisible(e.clientX <= 50 || isInsideMenu);
      } else {
        setIsVisible(e.clientX <= 50);
      }
    };

    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  return (
    <div
      ref={menuRef}
      className={`fixed left-0 top-0 h-screen z-50 transition-transform duration-300 ease-in-out ${
        isVisible ? "translate-x-0" : "-translate-x-full"
      }`}
    >
      <Card className="h-full w-64 bg-neutral-900/40 backdrop-blur-md border-neutral-800/50 rounded-r-xl">
        <div className="space-y-6 py-4">
          {/* Start New Code Space Button */}
          <div className="px-2">
            <button className="mt-8 flex items-center gap-2 w-full py-2 px-2 rounded-lg transition-colors duration-200 bg-transparent hover:bg-neutral-900 active:bg-stone-950 text-stone-500 hover:text-stone-400">
              <IoIosAddCircleOutline className="w-5 h-5" />
              <span className="text-sm">New</span>
            </button>
          </div>

          {/* Starred Section */}
          <div className="space-y-2 px-4">
            <h2 className="text-sm font-medium text-stone-400">Starred</h2>
            <ContextMenu.Root>
              <ContextMenu.Trigger>
                <div className="px-4 py-8 border border-dashed border-neutral-700 rounded-lg text-xs text-stone-400 text-center">
                  Star code spaces you use often
                </div>
              </ContextMenu.Trigger>
              <ContextMenu.Content className="min-w-[220px] bg-neutral-900 rounded-lg p-1 shadow-xl"></ContextMenu.Content>
            </ContextMenu.Root>
          </div>

          {/* Recent Section */}
          <div className="space-y-2 px-4">
            <h2 className="text-sm font-medium text-stone-400">Recent</h2>
            <ContextMenu.Root>
              <ContextMenu.Trigger>
                <div className="px-4 py-8 border border-dashed border-neutral-700 rounded-lg text-xs text-stone-400 text-center">
                  Recent code spaces appear here
                </div>
              </ContextMenu.Trigger>
              <ContextMenu.Content className="min-w-[220px] bg-neutral-900 rounded-lg p-1 shadow-xl">
                <ContextMenu.Item className="text-sm text-stone-400 hover:text-stone-200 hover:bg-neutral-800 rounded-md px-2 py-1.5 outline-none cursor-default">
                  No recent code spaces
                </ContextMenu.Item>
              </ContextMenu.Content>
            </ContextMenu.Root>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default SlideMenu;
