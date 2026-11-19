/** @type {import('tailwindcss').Config} */
module.exports = {
    content: ["./src/**/*.{js,jsx,ts,tsx}"],
    darkMode: "class",
    theme: {
        extend: {
            fontFamily: {
                display: ['"GFS Didot"', "Georgia", "serif"],
                sans: ["Manrope", "system-ui", "-apple-system", "Segoe UI", "sans-serif"],
            },
            keyframes: {
                "fade-in": { from: { opacity: 0 }, to: { opacity: 1 } },
                "fade-in-up": {
                    from: { opacity: 0, transform: "translateY(14px)" },
                    to: { opacity: 1, transform: "translateY(0)" },
                },
                "fade-in-down": {
                    from: { opacity: 0, transform: "translateY(-12px)" },
                    to: { opacity: 1, transform: "translateY(0)" },
                },
                "pop-in": {
                    from: { opacity: 0, transform: "scale(0.94)" },
                    to: { opacity: 1, transform: "scale(1)" },
                },
                "sheet-up": {
                    from: { transform: "translateY(100%)" },
                    to: { transform: "translateY(0)" },
                },
                float: {
                    "0%, 100%": { transform: "translateY(0) rotate(-3deg)" },
                    "50%": { transform: "translateY(-8px) rotate(3deg)" },
                },
                "pulse-soft": { "0%, 100%": { opacity: 1 }, "50%": { opacity: 0.6 } },
                toast: {
                    "0%": { opacity: 0, transform: "translate(-50%, -16px)" },
                    "10%, 85%": { opacity: 1, transform: "translate(-50%, 0)" },
                    "100%": { opacity: 0, transform: "translate(-50%, -8px)" },
                },
            },
            animation: {
                "fade-in": "fade-in 0.25s ease-out both",
                "fade-in-up": "fade-in-up 0.45s cubic-bezier(.2,.8,.2,1) both",
                "fade-in-down": "fade-in-down 0.6s cubic-bezier(.2,.8,.2,1) both",
                "pop-in": "pop-in 0.22s cubic-bezier(.2,.8,.2,1) both",
                "sheet-up": "sheet-up 0.35s cubic-bezier(.2,.8,.2,1) both",
                float: "float 3s ease-in-out infinite",
                "pulse-soft": "pulse-soft 2s ease-in-out infinite",
                toast: "toast 3.2s ease-out both",
            },
        },
    },
    plugins: [
        // «short:»: χαμηλή οθόνη, π.χ. κινητό γυρισμένο στο πλάι.
        // (Ως plugin και όχι ως «screen», ώστε να δουλεύουν και τα min-[...] / max-[...])
        ({ addVariant }) => addVariant("short", "@media (max-height: 559px)"),
    ],
};
