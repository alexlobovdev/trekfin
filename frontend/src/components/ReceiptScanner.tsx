import { useEffect, useRef, useState } from "react";
import { Camera, ImagePlus } from "lucide-react";
import type { IScannerControls } from "@zxing/browser";
import { api } from "../api";
import type { ReceiptPreview } from "../types";
import { Modal } from "./ui";

export default function ReceiptScanner({
  onClose,
  onScanned,
}: {
  onClose: () => void;
  onScanned: (receipt: ReceiptPreview) => void;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const controls = useRef<IScannerControls | null>(null);
  const active = useRef(true);
  const cameraRequest = useRef(0);
  const reading = useRef(false);
  const [camera, setCamera] = useState(false);
  const [qr, setQr] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
      cameraRequest.current++;
      controls.current?.stop();
    };
  }, []);
  const load = async (raw: string) => {
    if (reading.current) return;
    reading.current = true;
    cameraRequest.current++;
    controls.current?.stop();
    setCamera(false);
    setQr(raw);
    setBusy(true);
    setError("");
    try {
      const receipt = await api<ReceiptPreview>("receipts/preview", "POST", {
        qr: raw,
      });
      if (active.current) onScanned(receipt);
    } catch (e) {
      if (active.current) setError((e as Error).message);
    } finally {
      reading.current = false;
      if (active.current) setBusy(false);
    }
  };
  const start = async () => {
    const request = ++cameraRequest.current;
    setError("");
    setCamera(true);
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error();
      const { BrowserQRCodeReader } = await import("@zxing/browser");
      const scanner = await new BrowserQRCodeReader().decodeFromVideoDevice(
        undefined,
        video.current!,
        (result, _, scannerControls) => {
          if (
            result &&
            active.current &&
            request === cameraRequest.current &&
            !reading.current
          ) {
            scannerControls.stop();
            void load(result.getText());
          }
        },
      );
      if (
        !active.current ||
        reading.current ||
        request !== cameraRequest.current
      )
        scanner.stop();
      else controls.current = scanner;
    } catch {
      if (active.current && request === cameraRequest.current) {
        setCamera(false);
        setError(
          "Камера недоступна. Разрешите доступ к камере или выберите фото QR-кода.",
        );
      }
    }
  };
  const photo = async (file?: File) => {
    if (!file || reading.current) return;
    cameraRequest.current++;
    controls.current?.stop();
    setCamera(false);
    setBusy(true);
    setError("");
    const url = URL.createObjectURL(file);
    try {
      const { BrowserQRCodeReader } = await import("@zxing/browser");
      const result = await new BrowserQRCodeReader().decodeFromImageUrl(url);
      if (active.current) await load(result.getText());
    } catch {
      if (active.current)
        setError(
          "QR-код не найден. Выберите чёткое фото кода крупным планом или вставьте его текст.",
        );
    } finally {
      URL.revokeObjectURL(url);
      if (active.current) setBusy(false);
    }
  };
  return (
    <Modal title="Сканировать чек" onClose={onClose}>
      <div className="form">
        <p className="form-hint">
          Наведите камеру на QR-код фискального чека. Сумма и дата заполнятся из
          кода, товары загрузятся из сервиса проверки чеков.
        </p>
        <video
          ref={video}
          className={"receipt-camera" + (!camera ? " hidden" : "")}
          muted
          playsInline
          aria-label="Камера для сканирования чека"
        />
        <div className="receipt-scan-actions">
          <button
            type="button"
            className="button"
            disabled={busy || camera}
            onClick={start}
          >
            <Camera size={18} />
            Открыть камеру
          </button>
          <label className="button receipt-photo">
            <ImagePlus size={18} />
            Фото QR-кода
            <input
              type="file"
              accept="image/*"
              disabled={busy}
              onChange={(e) => {
                void photo(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
          </label>
        </div>
        <label>
          Текст QR-кода
          <textarea
            rows={3}
            maxLength={512}
            value={qr}
            onChange={(e) => setQr(e.target.value)}
            placeholder="t=…&s=…&fn=…&i=…&fp=…&n=1"
          />
        </label>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <button
          type="button"
          className="button primary"
          disabled={busy || !qr.trim()}
          onClick={() => load(qr.trim())}
        >
          {busy ? "Загружаем чек…" : "Загрузить чек"}
        </button>
      </div>
    </Modal>
  );
}
