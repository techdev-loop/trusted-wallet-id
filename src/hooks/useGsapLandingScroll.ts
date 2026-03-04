import { useLayoutEffect } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

let gsapRegistered = false;

export function useGsapLandingScroll() {
  useLayoutEffect(() => {
    if (typeof window === "undefined") return;

    if (!gsapRegistered) {
      gsap.registerPlugin(ScrollTrigger);
      gsapRegistered = true;
    }

    const ctx = gsap.context(() => {
      // Soft parallax on hero background wrapper
      gsap.to(".gsap-hero-wrap", {
        yPercent: -6,
        scrollTrigger: {
          trigger: ".gsap-hero-wrap",
          start: "top top",
          end: "bottom top",
          scrub: true,
        },
      });

      // Wave of sections rising into view
      gsap.utils.toArray<HTMLElement>(".gsap-section").forEach((section, index) => {
        gsap.fromTo(
          section,
          { opacity: 0, y: 60, rotateX: -8 },
          {
            opacity: 1,
            y: 0,
            rotateX: 0,
            duration: 0.9,
            ease: "power3.out",
            delay: index * 0.04,
            scrollTrigger: {
              trigger: section,
              start: "top 78%",
              toggleActions: "play none none reverse",
            },
          },
        );
      });

      // Cards hover / scroll lift
      gsap.utils.toArray<HTMLElement>(".gsap-orbit-card").forEach((card, i) => {
        gsap.fromTo(
          card,
          { opacity: 0, y: 40, scale: 0.96 },
          {
            opacity: 1,
            y: 0,
            scale: 1,
            duration: 0.7,
            ease: "power3.out",
            scrollTrigger: {
              trigger: card,
              start: "top 85%",
              toggleActions: "play none none reverse",
            },
          },
        );

        // subtle floating orbit effect tied to scroll
        gsap.to(card, {
          y: "+=14",
          rotateZ: i % 2 === 0 ? 1.5 : -1.5,
          ease: "none",
          scrollTrigger: {
            trigger: card,
            start: "top bottom",
            end: "bottom top",
            scrub: true,
          },
        });
      });

      // CTA spotlight sweep
      const cta = document.querySelector<HTMLElement>(".gsap-cta");
      if (cta) {
        const glow = document.createElement("div");
        glow.className =
          "pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_0%_0%,rgba(56,189,248,0.25),transparent_55%)] mix-blend-screen opacity-0";
        cta.appendChild(glow);

        gsap.fromTo(
          glow,
          { opacity: 0, xPercent: -40 },
          {
            opacity: 1,
            xPercent: 40,
            duration: 1.4,
            ease: "power2.out",
            scrollTrigger: {
              trigger: cta,
              start: "top 80%",
              toggleActions: "play none none reverse",
            },
          },
        );
      }
    });

    return () => {
      ctx.revert();
    };
  }, []);
}

