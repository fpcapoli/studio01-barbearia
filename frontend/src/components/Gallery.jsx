import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { imgSrc } from "@/lib/api";

export function Gallery({ items }) {
  const [open, setOpen] = useState(null);

  if (!items.length) return (
    <div className="rounded-xl border border-dashed border-zinc-800 p-10 text-center text-zinc-500">
      Em breve, fotos dos nossos cortes por aqui.
    </div>
  );

  return (
    <>
      <div className="columns-2 gap-3 sm:columns-3 lg:columns-4" data-testid="gallery-grid">
        {items.map((it, i) => (
          <motion.button
            key={it.id} onClick={() => setOpen(it)} data-testid="gallery-item"
            initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
            transition={{ delay: (i % 4) * 0.05 }}
            className="group relative mb-3 block w-full overflow-hidden rounded-lg border border-zinc-800"
          >
            <img src={imgSrc(it.url)} alt={it.caption || "Corte Studio01"} loading="lazy"
              className="w-full object-cover transition duration-500 group-hover:scale-105" />
            {it.caption && (
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent px-3 pb-2 pt-6 text-left font-heading text-sm font-bold uppercase text-white opacity-0 transition group-hover:opacity-100">
                {it.caption}
              </div>
            )}
          </motion.button>
        ))}
      </div>
      <AnimatePresence>
        {open && (
          <motion.div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/90 p-4"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setOpen(null)} data-testid="gallery-lightbox">
            <button className="absolute right-5 top-5 text-zinc-400 hover:text-white" data-testid="gallery-lightbox-close"><X size={26} /></button>
            <motion.figure initial={{ scale: 0.95 }} animate={{ scale: 1 }} className="max-h-full max-w-3xl" onClick={(e) => e.stopPropagation()}>
              <img src={imgSrc(open.url)} alt={open.caption} className="max-h-[80vh] rounded-lg object-contain" />
              {open.caption && <figcaption className="mt-3 text-center font-heading text-lg font-bold uppercase text-white">{open.caption}</figcaption>}
            </motion.figure>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
