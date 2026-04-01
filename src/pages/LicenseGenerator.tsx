
import { useState } from "react";
import { useLocation } from "react-router-dom";
import { licenseService, LicenseData } from "@/services/licenseService";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";
import { Copy } from "lucide-react";

const LicenseGenerator = () => {
  const location = useLocation();
  const [storeName, setStoreName] = useState(location.state?.storeName || "");
  const [months, setMonths] = useState("1");
  const [generatedKey, setGeneratedKey] = useState("");

  const handleGenerate = () => {
    if (!storeName) {
      toast.error("Store name is required");
      return;
    }

    const expiryDate = new Date();
    if (months === "7d") {
      expiryDate.setDate(expiryDate.getDate() + 7);
    } else {
      expiryDate.setMonth(expiryDate.getMonth() + parseInt(months));
    }

    const data: LicenseData = {
      storeName,
      expiryDate: expiryDate.toISOString(),
      type: months === "7d" ? 'weekly' : 'monthly'
    };

    const key = licenseService.generateLicense(data);
    setGeneratedKey(key);
    toast.success("License key generated!");
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(generatedKey);
    toast.success("Copied to clipboard");
  };

  return (
    <div className="min-h-screen bg-slate-100 p-8 flex items-center justify-center">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle>License Key Generator</CardTitle>
          <CardDescription>Generate monthly rental keys for clients</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Store Name</label>
            <Input
              value={storeName}
              onChange={(e) => setStoreName(e.target.value)}
              placeholder="e.g. Lahore Coffee Shop"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Duration</label>
            <Select value={months} onValueChange={setMonths}>
              <SelectTrigger>
                <SelectValue placeholder="Select duration" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7d">7 Days</SelectItem>
                <SelectItem value="1">1 Month</SelectItem>
                <SelectItem value="3">3 Months</SelectItem>
                <SelectItem value="6">6 Months</SelectItem>
                <SelectItem value="12">1 Year</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button onClick={handleGenerate} className="w-full">
            Generate Key
          </Button>

          {generatedKey && (
            <div className="mt-6 p-4 bg-slate-900 rounded-md overflow-hidden relative">
              <code className="text-green-400 text-xs break-all block pr-10">
                {generatedKey}
              </code>
              <Button
                size="icon"
                variant="ghost"
                className="absolute top-2 right-2 text-white hover:bg-white/20"
                onClick={copyToClipboard}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default LicenseGenerator;
