import { Dropdown } from "@/components/ui";
import { useAuth } from "@/contexts/AuthContext";
import {
  ArrowRightOnRectangleIcon,
  Cog6ToothIcon,
  UserCircleIcon,
  UserGroupIcon,
} from "@heroicons/react/24/outline";
import { clsx } from "clsx";
import Link from "next/link";
import { useRouter } from "next/router";
import React from "react";

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { user, logout } = useAuth();
  const router = useRouter();

  const navigation = [{ name: "Grupos", href: "/groups", icon: UserGroupIcon }];

  const userMenuItems = [
    {
      label: "Perfil",
      onClick: () => router.push("/profile"),
      icon: UserCircleIcon,
    },
    {
      label: "Configuración",
      onClick: () => router.push("/settings"),
      icon: Cog6ToothIcon,
    },
    {
      label: "Cerrar Sesión",
      onClick: logout,
      icon: ArrowRightOnRectangleIcon,
      danger: true,
    },
  ];

  const handleLogout = async () => {
    await logout();
    router.push("/login");
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation */}
      <nav className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            {/* Logo and main navigation */}
            <div className="flex">
              <div className="flex-shrink-0 flex items-center">
                <Link
                  href="/groups"
                  className="text-2xl font-bold text-primary-600"
                >
                  PayControl
                </Link>
              </div>
              <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
                {navigation.map((item) => {
                  const Icon = item.icon;
                  const isActive = router.pathname.startsWith(item.href);
                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      className={clsx(
                        "inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium",
                        {
                          "border-primary-500 text-gray-900": isActive,
                          "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700":
                            !isActive,
                        }
                      )}
                    >
                      <Icon className="w-4 h-4 mr-2" />
                      {item.name}
                    </Link>
                  );
                })}
              </div>
            </div>

            {/* User menu */}
            <div className="flex items-center">
              <Dropdown
                trigger={
                  <button className="flex items-center text-sm rounded-full focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500">
                    <div className="w-8 h-8 bg-primary-600 rounded-full flex items-center justify-center">
                      <span className="text-white font-medium">
                        {user?.full_name?.charAt(0) || "U"}
                      </span>
                    </div>
                    <span className="ml-2 text-gray-700 hidden sm:block">
                      {user?.full_name}
                    </span>
                  </button>
                }
                items={userMenuItems}
                align="right"
              />
            </div>
          </div>
        </div>

        {/* Mobile navigation */}
        <div className="sm:hidden">
          <div className="pt-2 pb-3 space-y-1">
            {navigation.map((item) => {
              const Icon = item.icon;
              const isActive = router.pathname.startsWith(item.href);
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={clsx(
                    "block pl-3 pr-4 py-2 border-l-4 text-base font-medium",
                    {
                      "bg-primary-50 border-primary-500 text-primary-700":
                        isActive,
                      "border-transparent text-gray-500 hover:bg-gray-50 hover:border-gray-300 hover:text-gray-700":
                        !isActive,
                    }
                  )}
                >
                  <div className="flex items-center">
                    <Icon className="w-5 h-5 mr-3" />
                    {item.name}
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </nav>

      {/* Main content */}
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">{children}</div>
      </main>
    </div>
  );
};

export default Layout;
