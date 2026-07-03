import { Upload } from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  parseProductsCsvText,
  type ProductCsvParseResult,
} from "@/lib/api/products";

type CsvImportModalProps = {
  open: boolean;
  isImporting?: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (csvText: string) => void;
};

export function CsvImportModal({
  open,
  isImporting,
  onOpenChange,
  onImport,
}: CsvImportModalProps) {
  const [csvText, setCsvText] = useState("");
  const [fileName, setFileName] = useState("");
  const parsed = useMemo<ProductCsvParseResult | null>(
    () => (csvText ? parseProductsCsvText(csvText) : null),
    [csvText],
  );

  const readFile = async (file: File | undefined) => {
    if (!file) {
      return;
    }

    setFileName(file.name);
    setCsvText(await file.text());
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[720px]">
        <DialogHeader>
          <DialogTitle>CSV 가져오기</DialogTitle>
          <DialogDescription>
            필수 컬럼은 sku, name_ko, category입니다.
          </DialogDescription>
        </DialogHeader>
        <label
          className="flex min-h-36 cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-border bg-muted/30 px-4 py-6 text-center hover:bg-muted/50"
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault();
            void readFile(event.dataTransfer.files[0]);
          }}
        >
          <Upload className="mb-3 h-6 w-6 text-muted-foreground" />
          <span className="text-sm font-medium">
            {fileName || "CSV 파일을 드롭하거나 선택하세요"}
          </span>
          <span className="mt-1 text-xs text-muted-foreground">UTF-8 CSV 권장</span>
          <input
            type="file"
            accept=".csv,text/csv"
            className="sr-only"
            onChange={(event) => void readFile(event.target.files?.[0])}
          />
        </label>
        {parsed ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span>
                유효 {parsed.products.length}건 / 오류 {parsed.errors.length}건
              </span>
              <Button
                disabled={parsed.errors.length > 0 || parsed.products.length === 0 || isImporting}
                onClick={() => onImport(csvText)}
              >
                가져오기
              </Button>
            </div>
            {parsed.errors.length > 0 ? (
              <div className="max-h-32 overflow-auto rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                {parsed.errors.map((error, index) => (
                  <p key={`${error.row}-${error.field}-${index}`}>
                    {error.row}행 {error.field}: {error.message}
                  </p>
                ))}
              </div>
            ) : null}
            {parsed.products.length > 0 ? (
              <div className="max-h-64 overflow-auto rounded-md border border-border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>SKU</TableHead>
                      <TableHead>제품명</TableHead>
                      <TableHead>카테고리</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parsed.products.slice(0, 10).map((product) => (
                      <TableRow key={product.sku}>
                        <TableCell className="font-mono text-xs">{product.sku}</TableCell>
                        <TableCell>{product.name_ko}</TableCell>
                        <TableCell>{product.category}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : null}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
