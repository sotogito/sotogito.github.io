document.addEventListener('DOMContentLoaded', function () {
  const img = document.querySelector('#main-img');
  const verticalText = document.querySelector('#overlay-vertical');

  img.addEventListener('mouseenter', function () {
    this.src = 'assets/images/fish_4.png';
    this.alt = 'human';
    verticalText.style.opacity = '1';
  });

  img.addEventListener('mouseleave', function () {
    this.src = 'assets/images/fish_3.png';
    this.alt = 'human';
    verticalText.style.opacity = '0';
  });
});
