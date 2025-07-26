document.addEventListener('DOMContentLoaded', function () {
  const img = document.querySelector('#main-img');
  const verticalText = document.querySelector('#vertical-text');

  img.addEventListener('mouseenter', function () {
    this.src = 'assets/images/human_conv.png';
    this.alt = 'human';
    verticalText.style.opacity = '1';
  });

  img.addEventListener('mouseleave', function () {
    this.src = 'assets/images/human.png';
    this.alt = 'human';
    verticalText.style.opacity = '0';
  });
});
