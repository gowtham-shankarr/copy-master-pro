// Help page JavaScript
document.addEventListener("DOMContentLoaded", function () {
  // Simple navigation for table of contents
  document.querySelectorAll(".toc a").forEach((link) => {
    link.addEventListener("click", (e) => {
      e.preventDefault();
      const targetId = link.getAttribute("href").substring(1);
      const targetElement = document.getElementById(targetId);
      if (targetElement) {
        targetElement.scrollIntoView({ behavior: "smooth" });
      }
    });
  });

  // Floating help button - scroll to top
  document.getElementById("floatingHelp").addEventListener("click", () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  });

  // Help button - open help page (redundant but consistent)
  document.getElementById("helpBtn").addEventListener("click", () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  });

  // Request Feature button
  document.getElementById("requestFeatureBtn").addEventListener("click", () => {
    window.open("https://forms.fillout.com/t/2QMi7uSS59us", "_blank");
  });
});
