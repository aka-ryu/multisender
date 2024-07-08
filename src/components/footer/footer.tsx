import React, { ReactElement } from "react";
import "./footer.css";

const Footer = (): ReactElement => {
  return (
    <footer className="footer">
      <div className="inner-footer">
        <div className="footer-links">
          <a href="/">Terms of Service</a>
          <a href="/">Privacy Policy</a>
          <a href="/">Cookie Policy</a>
        </div>
        <div className="social-media">
          <a href="/">Facebook</a>
          <a href="/">Twitter</a>
          <a href="/">Instagram</a>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
