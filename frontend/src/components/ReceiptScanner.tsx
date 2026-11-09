import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Camera, ImagePlus, ScanLine } from "lucide-react";
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
  const [cameraReady, setCameraReady] = useState(false);
  const [qr, setQr] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [slow, setSlow] = useState(false);
  const [stage, setStage] = useState<"photo" | "lookup">("lookup");
  const load = async (raw: string) => {
    if (reading.current) return;
    reading.current = true;
    cameraRequest.current++;
    controls.current?.stop();
    setCamera(false);
    setQr(raw);
    setStage("lookup");
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
    setCameraReady(false);
    setCamera(true);
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error();
      const { BrowserQRCodeReader } = await import("@zxing/browser");
      if (!active.current || request !== cameraRequest.current) return;
      const scanner = await new BrowserQRCodeReader().decodeFromVideoDevice(
        undefined,
        video.current!,
        (result, _, scannerControls) => {
          if (!active.current || request !== cameraRequest.current) {
            scannerControls.stop();
            return;
          }
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
  useEffect(() => {
    active.current = true;
    void start();
    return () => {
      active.current = false;
      cameraRequest.current++;
      controls.current?.stop();
    };
  }, []);
  useEffect(() => {
    setSlow(false);
    if (!busy) return;
    const timer = window.setTimeout(() => setSlow(true), 8000);
    return () => window.clearTimeout(timer);
  }, [busy]);
  const photo = async (file?: File) => {
    if (!file || reading.current) return;
    cameraRequest.current++;
    controls.current?.stop();
    setCamera(false);
    setBusy(true);
    setError("");
    setStage("photo");
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
      <div className="form receipt-scanner">
        <div className={"scanner-viewfinder" + (busy ? " is-loading" : "")}>
          <video
            ref={video}
            className={"receipt-camera" + (!camera || busy ? " hidden" : "")}
            onPlaying={() => setCameraReady(true)}
            onError={() => {
              if (!camera || busy) return;
              cameraRequest.current++;
              controls.current?.stop();
              setCamera(false);
              setError(
                "Не удалось включить камеру. Попробуйте ещё раз или загрузите фото QR-кода.",
              );
            }}
            muted
            playsInline
            aria-label="Камера для сканирования чека"
          />
          {busy ? (
            <div className="scanner-loading" role="status" aria-live="polite">
              <div className="spinner" />
              <strong>
                {stage === "photo" ? "Читаем QR-код…" : "Загружаем покупки…"}
              </strong>
              <p>
                {slow
                  ? "Сервису нужно чуть больше времени. Подождём ещё немного."
                  : stage === "photo"
                    ? "Ищем код на фотографии"
                    : "Сумму и дату возьмём из чека"}
              </p>
              <small>Загрузка может занять до 25 секунд</small>
            </div>
          ) : (
            <>
              <div className="scanner-reticle">
                <ScanLine size={48} strokeWidth={1} />
              </div>
              <div className="scanner-caption">
                <strong>
                  {camera
                    ? cameraReady
                      ? "Наведите камеру на QR-код"
                      : "Включаем камеру…"
                    : "Добавьте фото QR-кода"}
                </strong>
                <span>
                  {camera
                    ? "Держите чек ровно — код считаем автоматически"
                    : "Код должен быть целиком в кадре"}
                </span>
              </div>
            </>
          )}
        </div>
        {error && (
          <p className="scanner-error" role="alert">
            {error}
          </p>
        )}
        {!busy && (
          <div className="receipt-scan-actions">
            {!camera && (
              <button type="button" className="button" onClick={start}>
                <Camera size={18} />
                Включить камеру
              </button>
            )}
            <label className="button receipt-photo">
              <ImagePlus size={18} />
              {camera ? "Выбрать фото" : "Загрузить фото"}
              <input
                type="file"
                accept="image/*"
                onChange={(e) => {
                  void photo(e.target.files?.[0]);
                  e.target.value = "";
                }}
              />
            </label>
          </div>
        )}
        {!busy && (
          <details className="scanner-manual">
            <summary>У меня есть текст QR-кода</summary>
            <label>
              Вставьте текст кода
              <textarea
                rows={3}
                maxLength={512}
                value={qr}
                onChange={(e) => setQr(e.target.value)}
                placeholder="Скопируйте строку из приложения для чтения QR"
              />
            </label>
            <button
              type="button"
              className="button primary"
              disabled={!qr.trim()}
              onClick={() => load(qr.trim())}
            >
              Найти чек
            </button>
          </details>
        )}
        <button
          type="button"
          className="text-button scanner-back"
          onClick={onClose}
        >
          <ArrowLeft size={16} />
          {busy ? "Отменить загрузку" : "Назад"}
        </button>
      </div>
    </Modal>
  );
}
