import React, { Fragment } from 'react';
import { Menu, Transition } from '@headlessui/react';
import { ChevronDownIcon } from '@heroicons/react/20/solid';
import { clsx } from 'clsx';

interface DropdownItem {
  label: string;
  onClick: () => void;
  icon?: React.ComponentType<{ className?: string }>;
  disabled?: boolean;
  danger?: boolean;
}

interface DropdownProps {
  trigger: React.ReactNode;
  items: DropdownItem[];
  align?: 'left' | 'right';
  className?: string;
}

const Dropdown: React.FC<DropdownProps> = ({
  trigger,
  items,
  align = 'right',
  className,
}) => {
  return (
    <Menu as="div" className={clsx('relative inline-block text-left', className)}>
      <Menu.Button as="div">
        {trigger}
      </Menu.Button>

      <Transition
        as={Fragment}
        enter="transition ease-out duration-100"
        enterFrom="transform opacity-0 scale-95"
        enterTo="transform opacity-100 scale-100"
        leave="transition ease-in duration-75"
        leaveFrom="transform opacity-100 scale-100"
        leaveTo="transform opacity-0 scale-95"
      >
        <Menu.Items
          className={clsx(
            'absolute z-10 mt-2 w-56 origin-top-right divide-y divide-gray-100 rounded-md bg-white shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none',
            {
              'right-0': align === 'right',
              'left-0': align === 'left',
            }
          )}
        >
          <div className="py-1">
            {items.map((item, index) => {
              const Icon = item.icon;
              return (
                <Menu.Item key={index} disabled={item.disabled}>
                  {({ active }) => (
                    <button
                      onClick={item.onClick}
                      disabled={item.disabled}
                      className={clsx(
                        'group flex w-full items-center px-4 py-2 text-sm',
                        {
                          'bg-gray-100 text-gray-900': active && !item.danger,
                          'bg-red-100 text-red-900': active && item.danger,
                          'text-gray-700': !active && !item.danger && !item.disabled,
                          'text-red-700': !active && item.danger && !item.disabled,
                          'text-gray-400 cursor-not-allowed': item.disabled,
                        }
                      )}
                    >
                      {Icon && (
                        <Icon
                          className={clsx(
                            'mr-3 h-5 w-5',
                            {
                              'text-gray-400': !item.danger && !item.disabled,
                              'text-red-400': item.danger && !item.disabled,
                              'text-gray-300': item.disabled,
                            }
                          )}
                        />
                      )}
                      {item.label}
                    </button>
                  )}
                </Menu.Item>
              );
            })}
          </div>
        </Menu.Items>
      </Transition>
    </Menu>
  );
};

export default Dropdown;