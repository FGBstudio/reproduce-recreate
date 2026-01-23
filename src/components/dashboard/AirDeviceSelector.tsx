import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { ApiDevice } from "@/lib/api";

type Props = {
  devices: ApiDevice[];
  selectedIds: string[];
  onChange: (nextSelectedIds: string[]) => void;
};

const getDeviceLabel = (d: ApiDevice) => d.location || d.name || d.device_id || d.id;

export function AirDeviceSelector({ devices, selectedIds, onChange }: Props) {
  const allIds = devices.map((d) => d.id);
  const allSelected = allIds.length > 0 && selectedIds.length === allIds.length;
  const noneSelected = selectedIds.length === 0;

  const title = allSelected
    ? `Sonde aria: Tutte (${allIds.length})`
    : noneSelected
      ? "Sonde aria: Nessuna"
      : `Sonde aria: ${selectedIds.length}/${allIds.length}`;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="secondary" size="sm" className="h-8">
          {title}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuLabel>Seleziona dispositivi (Ambiente)</DropdownMenuLabel>
        <DropdownMenuSeparator />

        <DropdownMenuCheckboxItem
          checked={allSelected}
          onCheckedChange={(checked) => {
            onChange(checked ? allIds : []);
          }}
        >
          Seleziona tutte
        </DropdownMenuCheckboxItem>

        <DropdownMenuSeparator />

        {devices.map((d) => (
          <DropdownMenuCheckboxItem
            key={d.id}
            checked={selectedIds.includes(d.id)}
            onCheckedChange={(checked) => {
              if (checked) onChange(Array.from(new Set([...selectedIds, d.id])));
              else onChange(selectedIds.filter((id) => id !== d.id));
            }}
            className="whitespace-normal"
          >
            {getDeviceLabel(d)}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
