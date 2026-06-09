import { cn } from '../components/ui/utils';

export function rowHoverClass(active?: boolean) {
  return cn('transition-colors duration-150 ease-out', active ? 'bg-gray-100 dark:bg-gray-800' : 'hover:bg-gray-100 dark:hover:bg-gray-800');
}
