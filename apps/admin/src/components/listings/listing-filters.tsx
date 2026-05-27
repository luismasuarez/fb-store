import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";

export interface FilterValues {
  listingType: string;
  propertyType: string;
  province: string;
  bedrooms: string;
  minPrice: string;
  maxPrice: string;
  sort: string;
  search: string;
}

interface Props {
  values: FilterValues;
  onChange: (values: FilterValues) => void;
}

const PROVINCES = [
  "Pinar del Río", "Artemisa", "La Habana", "Mayabeque",
  "Matanzas", "Cienfuegos", "Villa Clara", "Sancti Spíritus",
  "Ciego de Ávila", "Camagüey", "Las Tunas", "Holguín",
  "Granma", "Santiago de Cuba", "Guantánamo", "Isla de la Juventud",
];

export function ListingFilters({ values, onChange }: Props) {
  const set = (key: keyof FilterValues, val: string | null) =>
    onChange({ ...values, [key]: val ?? "" });

  const reset = () =>
    onChange({
      listingType: "",
      propertyType: "",
      province: "",
      bedrooms: "",
      minPrice: "",
      maxPrice: "",
      sort: "",
      search: "",
    });

  const hasFilters = Object.values(values).some((v) => v !== "");

  return (
    <div className="flex flex-wrap gap-3 items-end">
      <div className="space-y-1">
        <label className="text-xs text-muted-foreground">Tipo</label>
        <Select value={values.listingType} onValueChange={(v) => set("listingType", v === " " ? "" : v)}>
          <SelectTrigger className="w-28">
            <SelectValue placeholder="Todos" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value=" ">Todos</SelectItem>
            <SelectItem value="sale">Venta</SelectItem>
            <SelectItem value="rent">Alquiler</SelectItem>
            <SelectItem value="swap">Permuta</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1">
        <label className="text-xs text-muted-foreground">Propiedad</label>
        <Select value={values.propertyType} onValueChange={(v) => set("propertyType", v === " " ? "" : v)}>
          <SelectTrigger className="w-32">
            <SelectValue placeholder="Todas" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value=" ">Todas</SelectItem>
            <SelectItem value="apartment">Apartamento</SelectItem>
            <SelectItem value="house">Casa</SelectItem>
            <SelectItem value="room">Cuarto</SelectItem>
            <SelectItem value="land">Terreno</SelectItem>
            <SelectItem value="commercial">Local</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1">
        <label className="text-xs text-muted-foreground">Provincia</label>
        <Select value={values.province} onValueChange={(v) => set("province", v === " " ? "" : v)}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Todas" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value=" ">Todas</SelectItem>
            {PROVINCES.map((p) => (
              <SelectItem key={p} value={p}>{p}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1">
        <label className="text-xs text-muted-foreground">Habitaciones</label>
        <Select value={values.bedrooms} onValueChange={(v) => set("bedrooms", v === " " ? "" : v)}>
          <SelectTrigger className="w-24">
            <SelectValue placeholder="Cualq." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value=" ">Cualquiera</SelectItem>
            {[1, 2, 3, 4, 5].map((n) => (
              <SelectItem key={n} value={String(n)}>{n}+</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1">
        <label className="text-xs text-muted-foreground">Precio min</label>
        <Input
          type="number"
          placeholder="0"
          className="w-24 h-9"
          value={values.minPrice}
          onChange={(e) => set("minPrice", e.target.value)}
        />
      </div>

      <div className="space-y-1">
        <label className="text-xs text-muted-foreground">Precio max</label>
        <Input
          type="number"
          placeholder="999999"
          className="w-24 h-9"
          value={values.maxPrice}
          onChange={(e) => set("maxPrice", e.target.value)}
        />
      </div>

      <div className="space-y-1">
        <label className="text-xs text-muted-foreground">Buscar</label>
        <Input
          placeholder="Título o descripción..."
          className="w-44 h-9"
          value={values.search}
          onChange={(e) => set("search", e.target.value)}
        />
      </div>

      <div className="space-y-1">
        <label className="text-xs text-muted-foreground">Orden</label>
        <Select value={values.sort} onValueChange={(v) => set("sort", v === " " ? "" : v)}>
          <SelectTrigger className="w-28">
            <SelectValue placeholder="Nuevos" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="newest">Más nuevos</SelectItem>
            <SelectItem value="oldest">Más viejos</SelectItem>
            <SelectItem value="price_asc">Precio ↑</SelectItem>
            <SelectItem value="price_desc">Precio ↓</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {hasFilters && (
        <Button variant="ghost" size="sm" onClick={reset}>
          Limpiar
        </Button>
      )}
    </div>
  );
}
