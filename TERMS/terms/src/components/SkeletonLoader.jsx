import React from 'react';
import Skeleton, { SkeletonTheme } from 'react-loading-skeleton';
import 'react-loading-skeleton/dist/skeleton.css';
import './SkeletonLoader.css';

export function SkeletonCard() {
  return (
    <SkeletonTheme baseColor="#f3f3f3" highlightColor="#ecebeb">
      <div className="skeleton-card">
        <Skeleton height={200} />
        <div className="skeleton-content">
          <Skeleton height={20} width="80%" />
          <Skeleton height={16} width="60%" />
          <Skeleton height={16} width="40%" />
        </div>
      </div>
    </SkeletonTheme>
  );
}

export function SkeletonTable({ rows = 5 }) {
  return (
    <SkeletonTheme baseColor="#f3f3f3" highlightColor="#ecebeb">
      <div className="skeleton-table">
        <div className="skeleton-table-header">
          <Skeleton height={40} />
        </div>
        {Array.from({ length: rows }).map((_, index) => (
          <div key={index} className="skeleton-table-row">
            <Skeleton height={60} />
          </div>
        ))}
      </div>
    </SkeletonTheme>
  );
}

export function SkeletonForm() {
  return (
    <SkeletonTheme baseColor="#f3f3f3" highlightColor="#ecebeb">
      <div className="skeleton-form">
        <Skeleton height={20} width="30%" className="skeleton-form-label" />
        <Skeleton height={40} className="skeleton-form-input" />
        <Skeleton height={20} width="25%" className="skeleton-form-label" />
        <Skeleton height={40} className="skeleton-form-input" />
        <Skeleton height={20} width="35%" className="skeleton-form-label" />
        <Skeleton height={100} className="skeleton-form-textarea" />
        <Skeleton height={40} width="120px" className="skeleton-form-button" />
      </div>
    </SkeletonTheme>
  );
}

export function SkeletonImageGrid({ items = 6 }) {
  return (
    <SkeletonTheme baseColor="#f3f3f3" highlightColor="#ecebeb">
      <div className="skeleton-image-grid">
        {Array.from({ length: items }).map((_, index) => (
          <div key={index} className="skeleton-image-item">
            <Skeleton height={150} />
            <Skeleton height={16} width="80%" className="skeleton-image-caption" />
          </div>
        ))}
      </div>
    </SkeletonTheme>
  );
}

export function SkeletonReportCard() {
  return (
    <SkeletonTheme baseColor="#f3f3f3" highlightColor="#ecebeb">
      <div className="skeleton-report-card">
        <div className="skeleton-report-header">
          <Skeleton height={24} width="70%" />
          <Skeleton height={20} width="30%" />
        </div>
        <div className="skeleton-report-content">
          <Skeleton height={16} width="90%" className="skeleton-report-line" />
          <Skeleton height={16} width="75%" className="skeleton-report-line" />
          <Skeleton height={16} width="60%" className="skeleton-report-line-last" />
        </div>
        <div className="skeleton-report-footer">
          <Skeleton height={32} width="100px" />
          <Skeleton height={20} width="80px" />
        </div>
      </div>
    </SkeletonTheme>
  );
}
